ALLOWED_HOSTS = [
    'colorchef.onrender.com',
    'localhost',
    '127.0.0.1',
]

CORS_ALLOWED_ORIGINS = [
    "https://colorcheffrontend.vercel.app",
    "http://localhost:3000",
]

# If needed, add APPEND_SLASH setting
APPEND_SLASH = False  # This prevents Django from automatically adding trailing slashes 