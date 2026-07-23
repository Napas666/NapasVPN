:: Copyright 2018 The Outline Authors
::
:: Licensed under the Apache License, Version 2.0 (the "License");
:: you may not use this file except in compliance with the License.
:: You may obtain a copy of the License at
::
::      http://www.apache.org/licenses/LICENSE-2.0
::
:: Unless required by applicable law or agreed to in writing, software
:: distributed under the License is distributed on an "AS IS" BASIS,
:: WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
:: See the License for the specific language governing permissions and
:: limitations under the License.

:: Stops/uninstalls and starts/reinstalls OutlineService.
:: Intended to be called by both the installer and client.
::
:: Does *not* fail if any step fails: the caller must check
:: whether the service is actually running (see final exit statement).
@echo off
setlocal EnableDelayedExpansion

set PWD=%~dp0%

:: Stop and delete the service.
%SystemRoot%\System32\net stop OutlineService
%SystemRoot%\System32\sc delete OutlineService

:: Install and start the service, configuring it to restart on boot.
:: NOTE: spaces after the arguments are necessary for a correct installation, do not remove!
rem (fork R7 gap#13) Keep the escaped inner quotes so the SERVICE ImagePath is QUOTED — an unquoted path
rem with spaces ("C:\Program Files (x86)\...") is the classic unquoted-service-path weakness (AV-flagged).
%SystemRoot%\System32\sc create OutlineService binpath= "\"%PWD%OutlineService.exe\"" displayname= "OutlineService" start= "auto"
%SystemRoot%\System32\net start OutlineService

:: This is for the client: sudo-prompt discards stdout/stderr if the script
:: exits with a non-zero return code *which will happen if any of the previous
:: commands failed*.
if exist "%~dp0%vanya.vpn" (
	"%~dp0add_tap_device.bat"
) else (
	copy NUL /y "%~dp0%vanya.vpn"
)
:: (fork) Auto-restart the routing service if it terminates abnormally (crash / unhandled
:: exception) so a dead OutlineService named pipe (client connect fails with ENOENT, surfaced as
:: "routing daemon is not running") self-heals in ~2s instead of requiring a full quit + relaunch.
:: Crash-only: a clean "net stop" during reinstall does not trigger these actions.
%SystemRoot%\System32\sc failure OutlineService reset= 86400 actions= restart/2000/restart/5000/restart/10000
exit /b 0
