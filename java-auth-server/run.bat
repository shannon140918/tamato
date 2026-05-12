@echo off
setlocal
if not exist target\tomato-auth-server-1.0.0.jar call build.bat
java -jar target\tomato-auth-server-1.0.0.jar
