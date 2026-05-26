#!/bin/bash

# Build the React frontend
cd frontend
npm install
npm run build
cd ..

# Copy the built frontend assets to the main directory
cp -r frontend/dist/* .