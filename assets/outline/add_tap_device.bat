"%~dp0tap-windows6\tapinstall.exe" remove tap0901
"%~dp0tap-windows6\tapinstall.exe" remove root\tap0901
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

@echo off
:: See https://ss64.com/nt/delayedexpansion.html
setlocal enabledelayedexpansion

set DEVICE_NAME=outline-tap0
set DEVICE_HWID=tap0901

:: Error codes for surfacing to the user and sentry.
set ERROR_TAP_INSTALL=1
set ERROR_TAP_FIND_NAME=2
set ERROR_TAP_RENAME=3
set ERROR_TAP_CONFIGURE_SUBNET=4
set ERROR_TAP_CONFIGURE_DNS=5

:: Because we've seen multiple failures due to commands (netsh, etc.) not being
:: found, append some common directories to the PATH.
::
:: Note:
::  - %SystemRoot% almost always expands to c:\windows.
::  - Do *not* surround with quotes.
set PATH=%PATH%;%SystemRoot%\system32;%SystemRoot%\system32\wbem;%SystemRoot%\system32\WindowsPowerShell/v1.0

:: Check whether the device already exists.
%SystemRoot%\System32\netsh interface show interface name=%DEVICE_NAME%
if %errorlevel% equ 0 (
  echo TAP network device already exists.
  goto :configure
)

:: Aggressive pre-cleanup: handle phantom outline-tap0 adapters from previous
:: failed installs. The tapinstall removes at the top remove drivers by HWID,
:: but a leftover named adapter without a proper PnP binding can still confuse
:: subsequent installs and cause "rename failed (code 3)" errors indefinitely.
:: This catches that orphan and removes it by name.
echo Cleaning up orphan outline-tap0 adapters from previous failed installs...
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Get-NetAdapter -Name '%DEVICE_NAME%' -ErrorAction SilentlyContinue | Remove-NetAdapter -Confirm:$false -ErrorAction SilentlyContinue" <nul

echo Creating TAP network device...
"%~dp0tap-windows6\tapinstall" install "%~dp0tap-windows6\OemVista.inf" %DEVICE_HWID%
if %errorlevel% neq 0 (
  echo Could not create TAP network device. >&2
  exit /b %ERROR_TAP_INSTALL%
)

:: Find the name of the most recently installed TAP device in the registry and rename it.
echo Searching for new TAP network device name...
call "%~dp0find_tap_device_name.bat" TAP_NAME
if %errorlevel% neq 0 (
  echo Could not find TAP device name. >&2
  exit /b %ERROR_TAP_FIND_NAME%
)
echo Found TAP device name: "%TAP_NAME%"

:: We've occasionally seen delays before netsh will "see" the new device, at least for
:: purposes of configuring IP and DNS ("netsh interface show interface name=xxx" does not
:: seem to be affected).
call :wait_for_device "%TAP_NAME%"

:: Rename retry loop: up to 5 attempts with 3-second delays. netsh sometimes
:: can't see a newly-created adapter for a while, especially with antivirus
:: interference. We try netsh first, then PowerShell as fallback (sometimes
:: PowerShell succeeds when netsh fails due to caching), then retry.
set RENAME_RETRIES=5

:try_rename
%SystemRoot%\System32\netsh interface set interface name="%TAP_NAME%" newname="%DEVICE_NAME%"
if %errorlevel% equ 0 goto :rename_ok
:: Fallback to PowerShell which sometimes succeeds when netsh fails.
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Rename-NetAdapter -Name '%TAP_NAME%' -NewName '%DEVICE_NAME%'" <nul
if %errorlevel% equ 0 goto :rename_ok
set /a RENAME_RETRIES-=1
if %RENAME_RETRIES% leq 0 goto :rename_failed
echo Rename failed, will retry... ^(%RENAME_RETRIES% attempts left^)
waitfor /t 3 thisisnotarealsignalname >nul 2>&1
goto :try_rename

:rename_failed
echo Could not rename TAP device after all retries. >&2
exit /b %ERROR_TAP_RENAME%

:rename_ok
echo TAP device renamed successfully.

:: Wait for the new name to propagate to netsh.
call :wait_for_device "%DEVICE_NAME%"

:: Attempt to configure the device even if waiting timed out.
:configure

:: Try to enable the device, in case it's somehow been disabled.
::
:: Annoyingly, this returns an error and outputs a confusing message if the device exists and is
:: already enabled:
::   This network connection does not exist.
::
:: So, continue even if this command fails - and always include its output.
echo (Re-)enabling TAP network device...
%SystemRoot%\System32\netsh interface set interface "%DEVICE_NAME%" admin=enabled
:: The powershell command is used to ensure the adapter is enabled if netsh fails and leaves it in
:: a disabled state. While no such failure has yet been observed, this command would correct it and
:: should behave idempotently otherwise.
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Enable-NetAdapter -Name '%DEVICE_NAME%'" <nul

:: Subnet config retry loop: up to 3 attempts with 3-second delays.
:: 10.0.85.x is a guess which we hope will work for most users (Docker for
:: Windows uses 10.0.75.x by default): if the address is already in use the
:: script will fail and the installer will show an error message to the user.
echo Configuring TAP device subnet...
set SUBNET_RETRIES=3

:try_subnet
%SystemRoot%\System32\netsh interface ip set address %DEVICE_NAME% static 10.0.85.2 255.255.255.255
if %errorlevel% equ 0 goto :subnet_ok
set /a SUBNET_RETRIES-=1
if %SUBNET_RETRIES% leq 0 goto :subnet_failed
echo Subnet config failed, will retry... ^(%SUBNET_RETRIES% attempts left^)
waitfor /t 3 thisisnotarealsignalname >nul 2>&1
goto :try_subnet

:subnet_failed
echo Could not set TAP network device subnet. >&2
exit /b %ERROR_TAP_CONFIGURE_SUBNET%

:subnet_ok

:: Primary DNS config retry loop.
:: Windows has no system-wide DNS server; each network device can have its
:: "own" set of DNS servers. Windows seems to use the DNS server(s) of the
:: network device associated with the default gateway. This is good for us
:: as it means we do not have to modify the DNS settings of any other network
:: device in the system. Configure with Cloudflare and Quad9 resolvers
echo Configuring primary DNS...
set DNS1_RETRIES=3

:try_dns1
%SystemRoot%\System32\netsh interface ip set dnsservers %DEVICE_NAME% static address=1.1.1.1
if %errorlevel% equ 0 goto :dns1_ok
set /a DNS1_RETRIES-=1
if %DNS1_RETRIES% leq 0 goto :dns1_failed
echo Primary DNS config failed, will retry... ^(%DNS1_RETRIES% attempts left^)
waitfor /t 3 thisisnotarealsignalname >nul 2>&1
goto :try_dns1

:dns1_failed
echo Could not configure TAP device primary DNS. >&2
exit /b %ERROR_TAP_CONFIGURE_DNS%

:dns1_ok

:: Secondary DNS config retry loop.
echo Configuring secondary DNS...
set DNS2_RETRIES=3

:try_dns2
%SystemRoot%\System32\netsh interface ip add dnsservers %DEVICE_NAME% 9.9.9.9 index=2
if %errorlevel% equ 0 goto :dns2_ok
set /a DNS2_RETRIES-=1
if %DNS2_RETRIES% leq 0 goto :dns2_failed
echo Secondary DNS config failed, will retry... ^(%DNS2_RETRIES% attempts left^)
waitfor /t 3 thisisnotarealsignalname >nul 2>&1
goto :try_dns2

:dns2_failed
echo Could not configure TAP device secondary DNS. >&2
exit /b %ERROR_TAP_CONFIGURE_DNS%

:dns2_ok

:: Force TAP adapter to the highest routing/binding priority (metric=1).
:: Without this, Windows may pick a physical adapter (Wi-Fi/Ethernet) for DNS
:: resolution based on default metric, which smartdnsblock then firewalls off
:: on the physical side -> the user sees DNS_PROBE_FINISHED_NXDOMAIN in browsers.
:: This is idempotent and harmless when the adapter is later in 'Media disconnected'.
echo Setting TAP adapter metric to 1 ^(preferred for routing/DNS^)...
%SystemRoot%\System32\netsh interface ipv4 set interface "%DEVICE_NAME%" metric=1 >nul 2>&1

:: Disable IPv6 on the TAP adapter explicitly.
::
:: Background: OutlineService blocks all outbound IPv6 traffic via WFP. But if
:: the user's physical adapter (Wi-Fi/Ethernet) has IPv6 enabled with an IPv6
:: DNS server from the router (RA), Windows' DNS Client still thinks AAAA
:: lookups are possible. Chrome then races A and AAAA queries; the AAAA path
:: times out (WFP block) while the A path goes via TAP -> Chrome's internal
:: resolver state becomes inconsistent and surfaces as DNS_PROBE_FINISHED_BAD_CONFIG.
::
:: Killing IPv6 on the TAP interface keeps the *tunnel* IPv4-only (which we
:: want anyway — we don't route IPv6 through it), and Disable-NetAdapterBinding
:: on ms_tcpip6 is the most reliable way to ensure no IPv6 state from the TAP
:: leaks into Chrome's resolver view of "this connection is dual-stack".
::
:: Both commands are idempotent and safe to no-op when already in the target state.
echo Disabling IPv6 on TAP adapter ^(prevents A/AAAA race causing BAD_CONFIG^)...
%SystemRoot%\System32\netsh interface ipv6 set interface "%DEVICE_NAME%" disabled >nul 2>&1
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Disable-NetAdapterBinding -Name '%DEVICE_NAME%' -ComponentID 'ms_tcpip6' -ErrorAction SilentlyContinue" <nul

:: Force the Windows DNS Client to re-evaluate every adapter's DNS config and
:: rebuild its resolver state. Without this kick, Chrome's own DnsConfigService
:: can keep a stale view of "active DNS sources" from before TAP came up
:: (especially after sleep/resume or rapid VPN reconnects) and report
:: DNS_PROBE_FINISHED_BAD_CONFIG even though netsh shows the TAP DNS as set.
::
:: Register-DnsClient is the modern PowerShell equivalent of `ipconfig
:: /registerdns` — same effect, but doesn't print to the console.
::
:: Note: we deliberately do NOT clear NRPT rules here — corporate admins
:: legitimately use them via GPO and we'd break those setups. We only
:: re-register, not reset.
echo Re-registering Windows DNS client...
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Register-DnsClient -ErrorAction SilentlyContinue" <nul

:: Flush the Windows DNS resolver cache so stale entries from before the VPN
:: came up (resolving to public IPs that are no longer reachable via the
:: tunnel route) don't trigger NXDOMAIN in browsers on first page load.
echo Flushing Windows DNS resolver cache...
ipconfig /flushdns >nul 2>&1

echo TAP network device added and configured successfully
exit /b 0

:: Waits up to 120 seconds until a device is visible to netsh. Accepts the device name as a parameter.
:: Exits with a non-zero code if the operation times out.
:wait_for_device
echo Testing that the network device "%~1" is visible to netsh...
%SystemRoot%\System32\netsh interface ip show interfaces | find "%~1" >nul 2>&1
if %errorlevel% equ 0 exit /b 0
for /l %%N in (1, 1, 12) do (
  echo Waiting... %%N
  :: timeout doesn't like the environment created by nsExec::ExecToStack and exits with:
  :: "ERROR: Input redirection is not supported, exiting the process immediately."
  waitfor /t 10 thisisnotarealsignalname >nul 2>&1
  %SystemRoot%\System32\netsh interface ip show interfaces | find "%~1" >nul 2>&1
  if !errorlevel! equ 0 exit /b 0
)
exit /b 1
