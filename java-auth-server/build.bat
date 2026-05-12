@echo off
setlocal
if not exist target\classes mkdir target\classes
javac -encoding UTF-8 -source 1.8 -target 1.8 -d target\classes src\main\java\com\tomato\auth\TomatoAuthServer.java
if errorlevel 1 exit /b %errorlevel%
jar cfe target\tomato-auth-server-1.0.0.jar com.tomato.auth.TomatoAuthServer -C target\classes .
echo Built target\tomato-auth-server-1.0.0.jar
