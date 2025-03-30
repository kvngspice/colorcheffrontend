import React, { useState, useRef } from "react";
import axios from "axios";
import { useDropzone } from "react-dropzone";
import logo from './assets/logo.svg';

const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const App = () => {
  const [image, setImage] = useState(null);
  const [colors, setColors] = useState([]);
  const [preview, setPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [numColors, setNumColors] = useState(4);
  const [pickedColors, setPickedColors] = useState([]);
  const [reserveColors, setReserveColors] = useState([]);
  const [colorRegions, setColorRegions] = useState([]);
  const [reserveRegions, setReserveRegions] = useState([]);
  const [isVideo, setIsVideo] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoStartTime, setVideoStartTime] = useState(0);
  const [videoEndTime, setVideoEndTime] = useState(5);
  const [isPosterized, setIsPosterized] = useState(false);
  const [pixelSize, setPixelSize] = useState(2);
  const [isLineArt, setIsLineArt] = useState(false);
  const [threshold, setThreshold] = useState(127);
  const [blurRadius, setBlurRadius] = useState(0);
  const [isBlendMode, setIsBlendMode] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const imageRef = useRef(null);
  const videoRef = useRef(null);

  const apiUrl = (process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

  const handleImageClick = (e) => {
    if (!imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = imageRef.current.width;
    canvas.height = imageRef.current.height;
    ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);

    const pixelData = ctx.getImageData(x, y, 1, 1).data;
    const color = [pixelData[0], pixelData[1], pixelData[2]];

    setPickedColors(prev => [...prev, color]);
  };

  const compressImage = async (file, maxWidth = 1200) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Calculate new dimensions
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          // Create canvas and compress
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to blob
          canvas.toBlob((blob) => {
            resolve(new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            }));
          }, 'image/jpeg', 0.8); // 0.8 quality
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'image/*': [],
      'video/*': []
    },
    onDrop: async (acceptedFiles) => {
      const file = acceptedFiles[0];
      const isVideoFile = file.type.startsWith('video/');
      setIsVideo(isVideoFile);
      setImageLoading(true);
      
      if (isVideoFile) {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          setVideoDuration(video.duration);
          setVideoEndTime(Math.min(5, video.duration));
        };
        video.src = URL.createObjectURL(file);
      } else {
        // Compress image before setting
        const compressedImage = await compressImage(file);
        setImage(compressedImage);
        setPreview(URL.createObjectURL(compressedImage));
      }
      
      setColors([]);
      setColorRegions([]);
      setReserveColors([]);
      setReserveRegions([]);
      setPickedColors([]);
    },
    maxSize: 50 * 1024 * 1024
  });

  const { getRootProps: getMainDropProps, getInputProps: getMainDropInputProps, isDragActive: isMainDropActive } = useDropzone({
    accept: "image/*",
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0];
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setColors([]);
      setColorRegions([]);
      setReserveColors([]);
      setReserveRegions([]);
      setPickedColors([]);
    },
    multiple: false
  });

  const validateImage = (file) => {
    const errors = [];
    
    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      errors.push("File too large. Maximum size is 10MB");
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      errors.push("Please upload an image file");
    }

    return errors;
  };

  const handleApiError = async (error, operation) => {
    console.error(`Error ${operation}:`, error);
    
    if (error.response) {
      if (error.response.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const data = JSON.parse(text);
          return `Failed to ${operation}: ${data.error || 'Unknown error'}`;
        } catch (e) {
          return `Failed to ${operation}. Please try again.`;
        }
      }
      return `Failed to ${operation}: ${error.response.data?.error || 'Unknown error'}`;
    }
    return `Failed to ${operation}. Please check your connection and try again.`;
  };

  const handleUpload = async () => {
    if (!image) return alert("Please select a file!");
    setIsLoading(true);

    const formData = new FormData();
    formData.append("file", image);
    formData.append("numColors", numColors);
    
    if (isVideo) {
      formData.append("startTime", videoStartTime);
      formData.append("endTime", videoEndTime);
    }

    try {
      const response = await axios.post(`${apiUrl}/api/upload/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        validateStatus: function (status) {
          return status < 500;
        }
      });
      setColors(response.data.colors);
      if (!response.data.isVideo) {
        setColorRegions(response.data.regions);
        setReserveColors(response.data.reserveColors);
        setReserveRegions(response.data.reserveRegions);
      } else {
        setReserveColors(response.data.reserveColors);
      }
    } catch (error) {
      const errorMessage = await handleApiError(error, 'upload file');
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadPaletteImage = (colors) => {
    // Create canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    const width = 800;
    const height = 400;
    canvas.width = width;
    canvas.height = height;

    // Fill background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    // Calculate color block width
    const blockWidth = width / colors.length;

    // Draw color blocks and HEX text
    colors.forEach((color, index) => {
      // Draw color block
      const x = index * blockWidth;
      ctx.fillStyle = `rgb(${color.join(',')})`;
      ctx.fillRect(x, 0, blockWidth, height - 100);

      // Convert to hex
      const hexColor = `#${color.map(c => c.toString(16).padStart(2, '0')).join('')}`;
      
      // Add HEX code
      ctx.fillStyle = '#000000';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      const centerX = x + (blockWidth / 2);
      
      // Draw HEX code only
      ctx.fillText(hexColor, centerX, height - 60);
    });

    // Convert canvas to blob and download
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = 'color-palette.png';
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  const handleRandomize = () => {
    // Check if we have valid arrays
    if (!colors?.length || !reserveColors?.length) return;
    
    // Create arrays with fallback empty arrays
    const currentColors = colors || [];
    const currentReserveColors = reserveColors || [];
    const currentRegions = colorRegions || [];
    const currentReserveRegions = reserveRegions || [];
    
    // Combine all colors and regions into pairs
    const allPairs = [...currentColors, ...currentReserveColors].map((color, index) => {
      // Get the corresponding region or create a default one
      let region;
      if (index < currentRegions.length) {
        region = currentRegions[index];
      } else if (index < (currentRegions.length + currentReserveRegions.length)) {
        region = currentReserveRegions[index - currentRegions.length];
      } else {
        region = { x: 0.5, y: 0.5 };
      }
      
      return { color, region };
    });
    
    // Only proceed if we have pairs to shuffle
    if (allPairs.length === 0) return;
    
    // Shuffle the pairs
    const shuffledPairs = shuffleArray(allPairs);
    
    // Split into active and reserve pairs
    const activePairs = shuffledPairs.slice(0, numColors);
    const reservePairs = shuffledPairs.slice(numColors);
    
    // Update state with new arrangements
    setColors(activePairs.map(p => p.color));
    setColorRegions(activePairs.map(p => p.region));
    setReserveColors(reservePairs.map(p => p.color));
    setReserveRegions(reservePairs.map(p => p.region));
  };

  const handlePosterize = async () => {
    if (!image) return alert("Please select an image first!");
    
    const errors = validateImage(image);
    if (errors.length > 0) {
      alert(errors.join("\n"));
      return;
    }
    
    setIsLoading(true);
    setImageLoading(true);

    const formData = new FormData();
    formData.append("file", image);
    formData.append("pixelSize", pixelSize);
    formData.append("numColors", numColors);

    try {
      const response = await axios.post(`${apiUrl}/api/posterize/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        responseType: 'blob'
      });

      const imageUrl = URL.createObjectURL(response.data);
      setPreview(imageUrl);
      setIsPosterized(true);
    } catch (error) {
      const errorMessage = await handleApiError(error, 'posterize image');
      alert(errorMessage);
    } finally {
      setIsLoading(false);
      setImageLoading(false);
    }
  };

  const handleDownloadPosterized = async (format) => {
    if (!preview || !isPosterized) return;

    try {
      if (format === 'png') {
        const link = document.createElement('a');
        link.href = preview;
        link.download = `posterized-image.png`;
        link.click();
      } else if (format === 'svg') {
        setIsLoading(true);
        const formData = new FormData();
        formData.append("file", image);
        formData.append("pixelSize", pixelSize);
        formData.append("numColors", numColors);

        console.log('Making SVG request to:', `${apiUrl}/api/posterize-svg/`);
        console.log('With parameters:', { pixelSize, numColors });

        const response = await axios.post(`${apiUrl}/api/posterize-svg/`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Accept': '*/*'
          },
          responseType: 'text'
        });

        // Create blob URL and trigger download
        const blob = new Blob([response.data], { type: 'image/svg+xml' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `posterized-image.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Error downloading image:", error);
      if (error.response) {
        console.error("Error status:", error.response.status);
        console.error("Error data:", error.response.data);
      }
      alert(`Failed to download ${format.toUpperCase()}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadLineArt = async (format) => {
    if (!preview || !isLineArt) return;

    if (format === 'png') {
      // For PNG, we can directly use the existing preview
      const link = document.createElement('a');
      link.href = preview;
      link.download = `line-art.png`;
      link.click();
    } else if (format === 'svg') {
      try {
        setIsLoading(true);
        const formData = new FormData();
        formData.append("file", image);
        formData.append("threshold", threshold);
        formData.append("blurRadius", blurRadius);

        const response = await axios.post(`${apiUrl}/api/line-art-svg/`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          responseType: 'blob'
        });

        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.download = `line-art.svg`;
        link.click();
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Error downloading SVG:", error);
        alert("Failed to download SVG");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleLineArt = async () => {
    if (!image) return alert("Please select an image first!");
    setIsLoading(true);
    setImageLoading(true);

    const formData = new FormData();
    formData.append("file", image);
    formData.append("threshold", threshold);
    formData.append("blurRadius", blurRadius);

    try {
      console.log('Making request to:', `${apiUrl}/api/line-art/`);
      console.log('With data:', { threshold, blurRadius });

      const response = await axios.post(`${apiUrl}/api/line-art/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        responseType: 'blob'
      });

      const imageUrl = URL.createObjectURL(response.data);
      setPreview(imageUrl);
      setIsLineArt(true);

    } catch (error) {
      console.error("Error creating line art:", error);
      if (error.response) {
        console.error("Error status:", error.response.status);
        console.error("Error data:", error.response.data);
      }
      alert("Failed to create line art");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBlendArt = async () => {
    if (!image || !isPosterized) return alert("Please posterize the image first!");
    setIsLoading(true);
    setImageLoading(true);

    const formData = new FormData();
    formData.append("file", image);
    formData.append("pixelSize", pixelSize);
    formData.append("numColors", numColors);
    formData.append("threshold", threshold);
    formData.append("blurRadius", blurRadius);

    // Add these debug lines
    console.log('Making blend request to:', `${apiUrl}/api/blend-art/`);
    console.log('With parameters:', {
      pixelSize,
      numColors,
      threshold,
      blurRadius
    });

    try {
      const response = await axios.post(`${apiUrl}/api/blend-art/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        responseType: 'blob'
      });

      const imageUrl = URL.createObjectURL(response.data);
      setPreview(imageUrl);
      setIsBlendMode(true);

    } catch (error) {
      console.error("Error blending art:", error);
      if (error.response) {
        // Add these debug lines
        console.error("Error status:", error.response.status);
        console.error("Error data:", error.response.data);
      }
      alert("Failed to blend art styles");
    } finally {
      setIsLoading(false);
    }
  };

  // Add video trimming controls
  const VideoControls = () => (
    <div className="mt-4 space-y-2">
      <h4 className="text-sm font-medium text-gray-700">Video Trim (Max 5s)</h4>
      <div className="flex items-center gap-4">
        <input
          type="range"
          min={0}
          max={videoDuration}
          step={0.1}
          value={videoStartTime}
          onChange={(e) => {
            const newStart = parseFloat(e.target.value);
            if (videoEndTime - newStart <= 5) {
              setVideoStartTime(newStart);
            }
          }}
          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
        />
        <span className="text-sm text-gray-600 w-16">
          {videoStartTime.toFixed(1)}s
        </span>
      </div>
      <div className="flex items-center gap-4">
        <input
          type="range"
          min={videoStartTime}
          max={Math.min(videoDuration, videoStartTime + 5)}
          step={0.1}
          value={videoEndTime}
          onChange={(e) => setVideoEndTime(parseFloat(e.target.value))}
          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
        />
        <span className="text-sm text-gray-600 w-16">
          {videoEndTime.toFixed(1)}s
        </span>
      </div>
    </div>
  );

  // Add this new component for video trimming
  const VideoTrimmer = ({ duration, startTime, endTime, onStartChange, onEndChange, onConfirm }) => {
    return (
      <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 mt-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-700">Video too long - Select 5s segment</h4>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 bg-purple-500 text-white text-sm rounded-lg hover:bg-purple-600 transition-colors"
          >
            Apply Trim
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="relative pt-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600">Start: {startTime.toFixed(1)}s</span>
              <span className="text-xs font-medium text-gray-600">End: {endTime.toFixed(1)}s</span>
            </div>
            {/* Timeline bar */}
            <div className="h-2 bg-gray-200 rounded-full">
              <div 
                className="h-full bg-purple-500 rounded-full"
                style={{
                  width: `${((endTime - startTime) / duration) * 100}%`,
                  marginLeft: `${(startTime / duration) * 100}%`
                }}
              />
            </div>
            {/* Range inputs */}
            <input
              type="range"
              min={0}
              max={Math.max(0, duration - 5)}
              step={0.1}
              value={startTime}
              onChange={(e) => onStartChange(parseFloat(e.target.value))}
              className="absolute top-0 left-0 w-full h-2 appearance-none bg-transparent pointer-events-auto"
            />
            <input
              type="range"
              min={startTime}
              max={Math.min(duration, startTime + 5)}
              step={0.1}
              value={endTime}
              onChange={(e) => onEndChange(parseFloat(e.target.value))}
              className="absolute top-0 left-0 w-full h-2 appearance-none bg-transparent pointer-events-auto"
            />
          </div>
          
          <div className="text-xs text-gray-500">
            Selected segment: {(endTime - startTime).toFixed(1)}s / 5s
          </div>
        </div>
      </div>
    );
  };

  // Add this inside the right side controls section of your return statement
  const PosterizeControls = () => (
    <div className="space-y-3 sm:space-y-4">
      <h3 className="text-sm sm:text-base md:text-lg font-semibold mb-2">
        Paint Settings
      </h3>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min="2"
          max="32"
          step="2"
          value={pixelSize}
          onChange={(e) => setPixelSize(parseInt(e.target.value))}
          className="flex-1 h-1.5 sm:h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
        />
        <span className="text-gray-700 font-medium w-16 sm:w-20 text-center text-xs sm:text-sm">
          {pixelSize}px
        </span>
      </div>
      <label className="text-[10px] sm:text-xs text-gray-500 italic block">
        [Larger pixels means images will be more pixelated, lower values will have more detail]
      </label>
  
      <button
        onClick={handlePosterize}
        disabled={isLoading || !image || isVideo}
        className={`
          w-full px-4 py-2 rounded-lg font-semibold text-white shadow-lg
          text-sm transition-all duration-300 transform hover:scale-105
          ${isLoading || !image || isVideo
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          }
        `}
      >
        {isLoading ? "Processing..." : "Paint Image"}
      </button>
      <label className="text-[10px] sm:text-xs text-gray-500 italic block">
        [adjust the color slider above for more color details]
      </label>
  
      {isPosterized && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => handleDownloadPosterized('png')}
              className="flex-1 px-4 py-2 rounded-lg font-semibold text-white shadow-lg
                       text-sm transition-all duration-300 transform hover:scale-105
                       bg-blue-500 hover:bg-blue-600"
            >
              Download PNG
            </button>
            <button
              onClick={() => handleDownloadPosterized('svg')}
              className="flex-1 px-4 py-2 rounded-lg font-semibold text-white shadow-lg
                       text-sm transition-all duration-300 transform hover:scale-105
                       bg-green-500 hover:bg-green-600"
            >
              Download SVG
            </button>
          </div>
          <button
            onClick={() => {
              setPreview(URL.createObjectURL(image));
              setIsPosterized(false);
            }}
            className="w-full px-4 py-2 rounded-lg font-semibold text-gray-700 shadow-lg
                     text-sm transition-all duration-300 transform hover:scale-105
                     border border-gray-300 bg-white hover:bg-gray-50"
          >
            Reset Image
          </button>
        </div>
      )}
    </div>
  );

  // Add LineArtControls component
  const LineArtControls = () => (
    <div className="space-y-3 sm:space-y-4">
      <h3 className="text-sm sm:text-base md:text-lg font-semibold mb-2">
        Line Art Settings
      </h3>
      <div className="space-y-2">
        <div>
          <label className="text-sm text-gray-600">Threshold</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="1"
              max="255"
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value))}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <span className="text-gray-700 font-medium w-12 text-center">
              {threshold}
            </span>
          </div>
        </div>
        <div>
          <label className="text-sm text-gray-600">Blur Radius</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="5"
              value={blurRadius}
              onChange={(e) => setBlurRadius(parseInt(e.target.value))}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <span className="text-gray-700 font-medium w-12 text-center">
              {blurRadius}
            </span>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleLineArt}
          disabled={isLoading || !image || isVideo}
          className={`
            flex-1 px-4 py-2 rounded-lg font-semibold text-white shadow-lg
            text-sm transition-all duration-300 transform hover:scale-105
            ${isLoading || !image || isVideo
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600"
            }
          `}
        >
          {isLoading ? "Processing..." : "Convert to Line Art ✏️"}
        </button>

        {isPosterized && (
          <button
            onClick={handleBlendArt}
            disabled={isLoading}
            className={`
              flex-1 px-4 py-2 rounded-lg font-semibold text-white shadow-lg
              text-sm transition-all duration-300 transform hover:scale-105
              ${isLoading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              }
            `}
          >
            {isLoading ? "Blending..." : "Blend with Painted Image 🎨"}
          </button>
        )}
      </div>
      {isLineArt && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => handleDownloadLineArt('png')}
              className="flex-1 px-4 py-2 rounded-lg font-semibold text-white shadow-lg
                       text-sm transition-all duration-300 transform hover:scale-105
                       bg-blue-500 hover:bg-blue-600"
            >
              Download PNG
            </button>
            <button
              onClick={() => handleDownloadLineArt('svg')}
              className="flex-1 px-4 py-2 rounded-lg font-semibold text-white shadow-lg
                       text-sm transition-all duration-300 transform hover:scale-105
                       bg-green-500 hover:bg-green-600"
            >
              Download SVG
            </button>
          </div>
          {(isLineArt || isBlendMode) && (
            <button
              onClick={() => {
                setPreview(URL.createObjectURL(image));
                setIsLineArt(false);
                setIsBlendMode(false);
              }}
              className="w-full px-4 py-2 rounded-lg font-semibold text-gray-700 shadow-lg
                       text-sm transition-all duration-300 transform hover:scale-105
                       border border-gray-300 bg-white hover:bg-gray-50"
            >
              Reset Image
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 animate-gradient p-2 sm:p-4">
      {/* Logo and Header Section - Adjust spacing and text size */}
      <div className="container mx-auto max-w-6xl px-2 sm:px-4 pt-4 sm:pt-6 pb-4 sm:pb-8">
        <img 
          src={logo} 
          alt="Color Chef Logo" 
          className="mx-auto mb-3 sm:mb-4 w-[180px] sm:w-[220px] md:w-[300px] lg:w-[400px] transition-all duration-300" 
        />

        <div className="text-center space-y-1 sm:space-y-2 md:space-y-4 max-w-2xl mx-auto px-2">
          <h1 className="text-lg sm:text-xl md:text-3xl font-light text-white leading-tight">
            <span className="block mb-1 sm:mb-2">-Extract beautiful colors from images and videos</span>
            <span className="block text-sm sm:text-lg md:text-2xl">
              -Turn your images into stunning paintings and line art in seconds.
            </span>
          </h1>
        </div>
      </div>

      {/* Main content area - Adjust spacing and layout */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-3 sm:gap-4 md:gap-6 px-2 sm:px-4">
        {/* Left Side - Image Section */}
        <div className="w-full md:w-1/2 bg-white/90 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 shadow-xl sm:shadow-2xl">
          {!preview ? (
            <div
              {...getMainDropProps()}
              className={`
                h-64 md:h-full border-3 border-dashed rounded-xl p-4 md:p-8 
                flex items-center justify-center transition-all duration-300 ease-in-out
                ${isMainDropActive 
                  ? "border-blue-500 bg-blue-50/50" 
                  : "border-gray-300 hover:border-purple-400 hover:bg-purple-50/50"
                }
              `}
            >
              <input {...getMainDropInputProps()} />
              <div className="text-center">
                <div className="text-4xl md:text-5xl mb-4">📸</div>
                <p className="text-gray-600 text-sm md:text-base">
                  {isMainDropActive
                    ? "Drop your image here!"
                    : "Drag & drop an image here, or click to select"}
                </p>
              </div>
            </div>
          ) : (
            <div className="relative h-full flex flex-col items-center justify-center">
              <div className="text-center mb-4 text-sm text-gray-600">
                {isVideo ? "Trim video if needed" : "Click on the image to pick specific colors"}
              </div>
              <div className="relative inline-block">
                {isVideo ? (
                  <div className="space-y-4">
                    <video
                      ref={videoRef}
                      src={preview}
                      controls
                      className="max-w-full rounded-lg shadow-lg"
                      style={{ maxHeight: '400px' }}
                      onLoadedMetadata={(e) => {
                        setVideoDuration(e.target.duration);
                        if (e.target.duration > 5) {
                          setVideoEndTime(Math.min(5, e.target.duration));
                        } else {
                          setVideoEndTime(e.target.duration);
                        }
                      }}
                    />
                    
                    {videoDuration > 5 && (
                      <VideoTrimmer
                        duration={videoDuration}
                        startTime={videoStartTime}
                        endTime={videoEndTime}
                        onStartChange={(newStart) => {
                          setVideoStartTime(newStart);
                          setVideoEndTime(Math.min(newStart + 5, videoDuration));
                        }}
                        onEndChange={(newEnd) => {
                          setVideoEndTime(newEnd);
                        }}
                        onConfirm={() => {
                          if (videoRef.current) {
                            videoRef.current.currentTime = videoStartTime;
                          }
                          handleUpload();
                        }}
                      />
                    )}
                  </div>
                ) : (
                  <>
                    <img
                      ref={imageRef}
                      src={preview}
                      alt="Preview"
                      onClick={handleImageClick}
                      className={`max-w-full rounded-lg shadow-lg cursor-crosshair 
                                ${imageLoading ? 'image-loading' : 'image-reveal'}`}
                      onLoad={() => setImageLoading(false)}
                    />
                    {imageLoading && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500"></div>
                          <span className="text-sm text-gray-600">Processing image...</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
                {/* Color Region Indicators */}
                {colorRegions && colors && colorRegions.map((region, index) => {
                  if (!colors[index]) return null; // Skip if no corresponding color
                  return (
                    <div
                      key={`region-${index}`}
                      className="absolute w-6 h-6 -mt-3 -ml-3 rounded-full border-2 border-white shadow-lg 
                                transform transition-all duration-300 hover:scale-110 z-10 group"
                      style={{
                        backgroundColor: `rgb(${colors[index].join(",")})`,
                        left: `${region.x * 100}%`,
                        top: `${region.y * 100}%`,
                      }}
                    >
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 
                                    opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-black/75 text-white px-2 py-1 rounded text-xs whitespace-nowrap">
                          Color {index + 1}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {/* Picked Colors Indicators */}
                {pickedColors.map((color, index) => (
                  <div
                    key={`picked-${index}`}
                    className="absolute w-6 h-6 -mt-3 -ml-3 rounded-full border-2 border-white shadow-lg cursor-pointer transform hover:scale-110 transition-transform"
                    style={{
                      backgroundColor: `rgb(${color.join(",")})`,
                      left: `${(index + 1) * 20}%`,
                      top: '50%'
                    }}
                  />
                ))}
              </div>
              {isVideo && <VideoControls />}
            </div>
          )}
        </div>

        {/* Right Side - Controls and Colors */}
        <div className="w-full md:w-1/2 bg-white/90 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 shadow-xl sm:shadow-2xl">
          <div className="space-y-3 sm:space-y-4 md:space-y-6">
            {/* Auto Extract Controls */}
            <div>
              <h3 className="text-sm sm:text-base md:text-lg font-semibold mb-2 md:mb-3">
                Auto Extract Colors
              </h3>
              <label className="text-[10px] sm:text-xs text-gray-500 italic block">
        [select the number of colors you want to extract]
      </label>
  
              <div className="flex flex-col gap-2 sm:gap-3 md:gap-4">
                {/* Color Count Slider */}
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="1"
                    value={numColors}
                    onChange={(e) => setNumColors(parseInt(e.target.value))}
                    className="flex-1 h-1.5 sm:h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <span className="text-gray-700 font-medium w-14 sm:w-16 md:w-20 text-center text-xs sm:text-sm md:text-base">
                    {numColors} Colors
                  </span>
                </div>

                {/* Upload and Extract Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  {/* Upload Button */}
                  <div {...getRootProps()} className="flex-1">
                    <button
                      type="button"
                      className="w-full px-4 md:px-6 py-2.5 md:py-3 rounded-full font-semibold text-white shadow-lg
                               text-sm md:text-base transition-all duration-300 transform hover:scale-105
                               bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                    >
                      <input {...getInputProps()} />
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L12 8m4-4v12" />
                        </svg>
                        Upload Image
                      </span>
                    </button>
                  </div>

                  {/* Extract Button */}
                  <button
                    onClick={handleUpload}
                    disabled={isLoading}
                    className={`
                      flex-1 px-4 md:px-6 py-2.5 md:py-3 rounded-full font-semibold text-white shadow-lg
                      text-sm md:text-base transition-all duration-300 transform hover:scale-105
                      ${isLoading || !image
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                      }
                    `}
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Extracting...
                      </span>
                    ) : !image ? (
                      "Upload First"
                    ) : (
                      "Extract Colors 🎨"
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Extracted Colors Palette - Moved here */}
            {colors.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-2 md:mb-3">
                  <h3 className="text-base md:text-lg font-semibold">Extracted Palette</h3>
                  <button
                    onClick={handleRandomize}
                    className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm 
                           bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Shuffle
                  </button>
                </div>
                <div className="relative">
                  {/* Main Palette Display */}
                  <div className="h-16 rounded-lg shadow-lg overflow-hidden flex relative">
                    {isLoading && (
                      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center">
                        <div className="flex items-center gap-2">
                          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span className="text-white">Updating...</span>
                        </div>
                      </div>
                    )}
                    {colors.map((color, index) => {
                      const hexColor = `#${color.map(c => c.toString(16).padStart(2, '0')).join('')}`;
                      return (
                        <div
                          key={index}
                          className="flex-1 group relative cursor-pointer transform transition-all duration-300 hover:scale-y-110"
                          style={{ backgroundColor: `rgb(${color.join(",")})` }}
                        >
                          {/* Color Info Overlay */}
                          <div className="opacity-0 group-hover:opacity-100 absolute inset-0 
                                        bg-black/50 backdrop-blur-sm transition-opacity
                                        flex flex-col items-center justify-center text-white text-xs">
                            <div className="font-medium">{hexColor}</div>
                            <div className="text-white/80">RGB: {color.join(", ")}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Control Buttons */}
                  <div className="absolute -right-2 top-1/2 transform -translate-y-1/2 flex flex-col gap-1">
                    <button 
                      className="w-6 h-6 rounded bg-white shadow-md flex items-center justify-center hover:bg-gray-100 transition-colors"
                      onClick={() => setNumColors(prev => Math.min(prev + 1, 20))}
                    >
                      +
                    </button>
                    <button 
                      className="w-6 h-6 rounded bg-white shadow-md flex items-center justify-center hover:bg-gray-100 transition-colors"
                      onClick={() => setNumColors(prev => Math.max(prev - 1, 1))}
                    >
                      -
                    </button>
                  </div>
                </div>

                {/* Export Button */}
                <div className="flex justify-end mt-3 md:mt-4">
                  <button
                    onClick={() => downloadPaletteImage(colors)}
                    className="px-6 md:px-10 py-2 md:py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 
                           transition-colors flex items-center gap-2 text-xs md:text-sm"
                  >
                    <svg 
                      className="w-4 h-4" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Export Palette
                  </button>
                </div>
              </div>
            )}

            {/* Posterize Controls */}
            {!isVideo && (
              <>
                <PosterizeControls />
                <div className="mt-4">
                  <LineArtControls />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer - Adjust spacing */}
      <footer className="mt-4 sm:mt-8 text-center text-white text-sm sm:text-base pb-4">
        <p>
          Built by <a href="https://www.instagram.com/kvngspice_/" className="underline">Samson Adebayo</a>
        </p>
      </footer>
    </div>
  );
};

export default App;
