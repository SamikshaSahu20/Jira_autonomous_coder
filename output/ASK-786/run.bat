@echo off
npm install
if not defined PORT set PORT=3000
node server.js
