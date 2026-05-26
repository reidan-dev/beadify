#!/bin/bash

# Set the working directory
cd /vercel/path0

# Build the React frontend
cd frontend
npm install --prefer-offline
npm run build
cd ..

# Ensure the built assets are properly placed
echo "Built frontend assets:"
ls -la frontend/dist/