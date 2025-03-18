import React, { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";
import { useDropzone } from "react-dropzone";
import { debounce } from 'lodash';
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
  const imageRef = useRef(null);
  const videoRef = useRef(null);

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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': [],
      'video/*': []
    },
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0];
      const isVideoFile = file.type.startsWith('video/');
      setIsVideo(isVideoFile);
      
      if (isVideoFile) {
        // Create video element to get duration
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          setVideoDuration(video.duration);
          setVideoEndTime(Math.min(5, video.duration));
        };
        video.src = URL.createObjectURL(file);
      }
      
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setColors([]);
      setColorRegions([]);
      setReserveColors([]);
      setReserveRegions([]);
      setPickedColors([]);
    },
    maxSize: 50 * 1024 * 1024 // 50MB limit
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

  const extractColors = async (count) => {
    if (!image) return;
    setIsLoading(true);

    const formData = new FormData();
    formData.append("file", image);
    formData.append("numColors", count);

    try {
      const response = await axios.post("http://127.0.0.1:8000/api/upload/", formData);
      setColors(response.data.colors);
      if (!response.data.isVideo) {
        setColorRegions(response.data.regions);
        setReserveColors(response.data.reserveColors);
        setReserveRegions(response.data.reserveRegions);
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Failed to extract colors.");
    } finally {
      setIsLoading(false);
    }
  };

  // Create a debounced version of extractColors
  const debouncedExtractColors = useCallback(() => {
    extractColors(numColors);
  }, [numColors]);

  // Update the useEffect
  useEffect(() => {
    if (colors.length > 0 && image) {
      debouncedExtractColors();
    }
  }, [numColors, debouncedExtractColors, colors.length, image]);

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
      const response = await axios.post("http://127.0.0.1:8000/api/upload/", formData);
      setColors(response.data.colors);
      if (!response.data.isVideo) {
        setColorRegions(response.data.regions);
        setReserveColors(response.data.reserveColors);
        setReserveRegions(response.data.reserveRegions);
      } else {
        setReserveColors(response.data.reserveColors);
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Failed to extract colors.");
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 animate-gradient p-4">
      <br />
      <img 
        src={logo} 
        alt="Color Chef Logo" 
        className="mx-auto mb-4 w-full max-w-xs md:max-w-md lg:max-w-lg" 
      />

      <p className="text-2xl md:text-2xl font-light text-center text-white mb-4 md:mb-8">
        Extract beautiful colors from images and videos
      </p>
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-4 md:gap-6">
        {/* Left Side - Image Section */}
        <div className="w-full md:w-1/2 bg-white/90 backdrop-blur-sm rounded-2xl p-4 md:p-6 shadow-2xl">
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
                  <img
                    ref={imageRef}
                    src={preview}
                    alt="Preview"
                    onClick={handleImageClick}
                    className="max-w-full rounded-lg shadow-lg cursor-crosshair"
                  />
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
        <div className="w-full md:w-1/2 bg-white/90 backdrop-blur-sm rounded-2xl p-4 md:p-6 shadow-2xl">
          <div className="space-y-4 md:space-y-6">
            {/* Picked Colors Section */}
            {pickedColors.length > 0 && (
              <div>
                <h3 className="text-base md:text-lg font-semibold mb-2 md:mb-3">Picked Colors</h3>
                <div className="flex gap-2 flex-wrap">
                  {pickedColors.map((color, index) => (
                    <div
                      key={`palette-${index}`}
                      className="group relative"
                    >
                      <div 
                        className="w-12 h-12 rounded-lg shadow-md transform transition-all duration-300 
                                 hover:scale-110 hover:shadow-lg"
                        style={{ backgroundColor: `rgb(${color.join(",")})` }}
                      />
                      <div className="opacity-0 group-hover:opacity-100 absolute -bottom-6 left-1/2 transform -translate-x-1/2 
                                    bg-black/75 text-white px-2 py-1 rounded-md text-xs whitespace-nowrap">
                        RGB: {color.join(", ")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Auto Extract Controls */}
            <div>
              <h3 className="text-base md:text-lg font-semibold mb-2 md:mb-3">Auto Extract Colors</h3>
              <div className="flex flex-col gap-3 md:gap-4">
                {/* Color Count Slider */}
                <div className="flex items-center gap-2 md:gap-4">
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={numColors}
                    onChange={(e) => setNumColors(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    disabled={isLoading}
                  />
                  <span className="text-gray-700 font-medium w-16 md:w-20 text-center text-sm md:text-base">
                    {numColors} Colors
                  </span>
                </div>

                {/* Buttons Container */}
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

            {/* Extracted Colors Palette */}
            {colors.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-2 md:mb-3">
                  <h3 className="text-base md:text-lg font-semibold">Extracted Palette</h3>
                  <button
                    onClick={handleRandomize}
                    className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm 
                           bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
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
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                      />
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
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-8 text-center text-white">
        <p>
          Built by <a href="https://www.instagram.com/kvngspice_/" className="underline">Samson Adebayo</a>
        </p>
      </footer>
    </div>
  );
};

export default App;
