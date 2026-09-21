$ErrorActionPreference = 'Stop'
$action = '__ACTION__'

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class MonCal {
  public delegate bool MonitorEnumProc(IntPtr hMonitor, IntPtr hdc, IntPtr lprc, IntPtr dwData);
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
  public struct MONITORINFOEX {
    public int cbSize;
    public RECT rcMonitor;
    public RECT rcWork;
    public uint dwFlags;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
    public string szDevice;
  }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
  public struct PHYSICAL_MONITOR {
    public IntPtr hPhysicalMonitor;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
    public string szPhysicalMonitorDescription;
  }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
  public struct DEVMODE {
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
    public string dmDeviceName;
    public short dmSpecVersion;
    public short dmDriverVersion;
    public short dmSize;
    public short dmDriverExtra;
    public int dmFields;
    public int dmPositionX;
    public int dmPositionY;
    public int dmDisplayOrientation;
    public int dmDisplayFixedOutput;
    public short dmColor;
    public short dmDuplex;
    public short dmYResolution;
    public short dmTTOption;
    public short dmCollate;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
    public string dmFormName;
    public short dmLogPixels;
    public int dmBitsPerPel;
    public int dmPelsWidth;
    public int dmPelsHeight;
    public int dmDisplayFlags;
    public int dmDisplayFrequency;
    public int dmICMMethod;
    public int dmICMIntent;
    public int dmMediaType;
    public int dmDitherType;
    public int dmReserved1;
    public int dmReserved2;
    public int dmPanningWidth;
    public int dmPanningHeight;
  }
  [DllImport("user32.dll")]
  public static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr clip, MonitorEnumProc proc, IntPtr data);
  [DllImport("user32.dll", CharSet = CharSet.Auto)]
  public static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFOEX info);
  [DllImport("user32.dll", CharSet = CharSet.Auto)]
  public static extern bool EnumDisplaySettings(string device, int mode, ref DEVMODE devMode);
  [DllImport("user32.dll", CharSet = CharSet.Auto)]
  public static extern int ChangeDisplaySettingsEx(string device, ref DEVMODE devMode, IntPtr hwnd, uint flags, IntPtr param);
  [DllImport("dxva2.dll", SetLastError = true)]
  public static extern bool GetNumberOfPhysicalMonitorsFromHMONITOR(IntPtr hMonitor, out uint count);
  [DllImport("dxva2.dll", SetLastError = true, CharSet = CharSet.Auto)]
  public static extern bool GetPhysicalMonitorsFromHMONITOR(IntPtr hMonitor, uint count, [Out] PHYSICAL_MONITOR[] monitors);
  [DllImport("dxva2.dll", SetLastError = true)]
  public static extern bool DestroyPhysicalMonitors(uint count, PHYSICAL_MONITOR[] monitors);
  [DllImport("dxva2.dll", SetLastError = true)]
  public static extern bool GetVCPFeatureAndVCPFeatureReply(IntPtr handle, byte code, out uint type, out uint current, out uint max);
  [DllImport("dxva2.dll", SetLastError = true)]
  public static extern bool SetVCPFeature(IntPtr handle, byte code, uint value);
  [DllImport("dxva2.dll", SetLastError = true)]
  public static extern bool GetCapabilitiesStringLength(IntPtr handle, out uint length);
  [DllImport("dxva2.dll", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern bool CapabilitiesRequestAndCapabilitiesReply(IntPtr handle, StringBuilder caps, uint length);
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
  public struct DISPLAY_DEVICE {
    public int cb;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
    public string DeviceName;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
    public string DeviceString;
    public uint StateFlags;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
    public string DeviceID;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
    public string DeviceKey;
  }
  [DllImport("user32.dll", CharSet = CharSet.Auto)]
  public static extern bool EnumDisplayDevices(string device, uint devNum, ref DISPLAY_DEVICE displayDevice, uint flags);
  [StructLayout(LayoutKind.Sequential)]
  public struct LUID { public uint LowPart; public int HighPart; }
  [StructLayout(LayoutKind.Sequential)]
  public struct RATIONAL { public uint Numerator; public uint Denominator; }
  [StructLayout(LayoutKind.Sequential)]
  public struct PATH_SOURCE {
    public LUID adapterId;
    public uint id;
    public uint modeInfoIdx;
    public uint statusFlags;
  }
  [StructLayout(LayoutKind.Sequential)]
  public struct PATH_TARGET {
    public LUID adapterId;
    public uint id;
    public uint modeInfoIdx;
    public uint outputTechnology;
    public uint rotation;
    public uint scaling;
    public RATIONAL refreshRate;
    public uint scanLineOrdering;
    public int targetAvailable;
    public uint statusFlags;
  }
  [StructLayout(LayoutKind.Sequential)]
  public struct PATH_INFO {
    public PATH_SOURCE sourceInfo;
    public PATH_TARGET targetInfo;
    public uint flags;
  }
  [StructLayout(LayoutKind.Explicit, Size = 80)]
  public struct MODE_INFO {
    [FieldOffset(0)] public uint infoType;
    [FieldOffset(4)] public uint id;
    [FieldOffset(8)] public LUID adapterId;
  }
  [StructLayout(LayoutKind.Sequential)]
  public struct DEVICE_HEADER {
    public uint type;
    public uint size;
    public LUID adapterId;
    public uint id;
  }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct SOURCE_NAME {
    public DEVICE_HEADER header;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
    public string viewGdiDeviceName;
  }
  [StructLayout(LayoutKind.Sequential)]
  public struct COLOR_INFO {
    public DEVICE_HEADER header;
    public uint value;
    public uint colorEncoding;
    public uint bitsPerColorChannel;
  }
  [StructLayout(LayoutKind.Sequential)]
  public struct SET_COLOR {
    public DEVICE_HEADER header;
    public uint enableAdvancedColor;
  }
  [DllImport("user32.dll")]
  public static extern int GetDisplayConfigBufferSizes(uint flags, out uint pathCount, out uint modeCount);
  [DllImport("user32.dll")]
  public static extern int QueryDisplayConfig(uint flags, ref uint pathCount, [Out] PATH_INFO[] paths, ref uint modeCount, [Out] MODE_INFO[] modes, IntPtr topology);
  [DllImport("user32.dll")]
  public static extern int DisplayConfigGetDeviceInfo(ref SOURCE_NAME packet);
  [DllImport("user32.dll")]
  public static extern int DisplayConfigGetDeviceInfo(ref COLOR_INFO packet);
  [DllImport("user32.dll")]
  public static extern int DisplayConfigSetDeviceInfo(ref SET_COLOR packet);
}
"@

function Read-Vcp([IntPtr]$handle, [byte]$code) {
  $type = 0; $current = 0; $max = 0
  $ok = [MonCal]::GetVCPFeatureAndVCPFeatureReply($handle, $code, [ref]$type, [ref]$current, [ref]$max)
  if (-not $ok) { return $null }
  return @{ current = [int]$current; max = [int]$max }
}

function Write-Vcp([IntPtr]$handle, [byte]$code, [uint32]$value) {
  return [MonCal]::SetVCPFeature($handle, $code, $value)
}

function Get-Caps([IntPtr]$handle) {
  $length = 0
  if (-not [MonCal]::GetCapabilitiesStringLength($handle, [ref]$length)) { return '' }
  if ($length -lt 8 -or $length -gt 20000) { return '' }
  $builder = New-Object System.Text.StringBuilder ([int]$length)
  if (-not [MonCal]::CapabilitiesRequestAndCapabilitiesReply($handle, $builder, $length)) { return '' }
  return $builder.ToString()
}

function Get-FpsCode([string]$caps) {
  if ($caps -match 'DC\(([^)]*)\)') {
    $vals = @([regex]::Matches($Matches[1], '[0-9A-Fa-f]+') | ForEach-Object { [Convert]::ToInt32($_.Value, 16) })
    if ($vals.Count -ge 5) { return [int]$vals[4] }
    if ($vals -contains 4) { return 4 }
  }
  if ($caps -match '(^|[^0-9A-Fa-f])DC([^0-9A-Fa-f]|$)') { return 4 }
  return $null
}

function Get-Refresh([string]$device, [bool]$apply) {
  $current = New-Object MonCal+DEVMODE
  $current.dmSize = [Runtime.InteropServices.Marshal]::SizeOf($current)
  $enumCurrent = -1
  if (-not [MonCal]::EnumDisplaySettings($device, $enumCurrent, [ref]$current)) {
    return @{ ok = $false; hz = $null; max = $null; width = $null; height = $null }
  }
  $best = $null
  $bestHz = 0
  for ($i = 0; $i -lt 400; $i++) {
    $mode = New-Object MonCal+DEVMODE
    $mode.dmSize = [Runtime.InteropServices.Marshal]::SizeOf($mode)
    if (-not [MonCal]::EnumDisplaySettings($device, $i, [ref]$mode)) { break }
    if ($mode.dmPelsWidth -ne $current.dmPelsWidth -or $mode.dmPelsHeight -ne $current.dmPelsHeight) { continue }
    if ($mode.dmBitsPerPel -lt 32) { continue }
    if (($mode.dmDisplayFlags -band 2) -ne 0) { continue }
    if ($mode.dmDisplayFrequency -gt $bestHz) {
      $bestHz = $mode.dmDisplayFrequency
      $best = $mode
    }
  }
  $changed = $false
  if ($apply -and $null -ne $best -and $bestHz -gt $current.dmDisplayFrequency) {
    $best.dmFields = 0x00080000 -bor 0x00100000 -bor 0x00040000 -bor 0x00400000
    $code = [MonCal]::ChangeDisplaySettingsEx($device, [ref]$best, [IntPtr]::Zero, 0x01, [IntPtr]::Zero)
    $changed = ($code -eq 0)
    if ($changed) { $current = $best }
  }
  $atMax = $null -ne $best -and [int]$current.dmDisplayFrequency -eq $bestHz
  return @{
    ok = $changed -or ($null -eq $best)
    hz = [int]$current.dmDisplayFrequency
    max = $(if ($bestHz -gt 0) { [int]$bestHz } else { [int]$current.dmDisplayFrequency })
    width = [int]$current.dmPelsWidth
    height = [int]$current.dmPelsHeight
    applied = $atMax -or $changed
  }
}

function Decode-EdidText($chars) {
  if (-not $chars) { return '' }
  -join ($chars | Where-Object { $_ -ne 0 } | ForEach-Object { [char]$_ })
}

$script:panelNames = @{}
Get-CimInstance -Namespace root\wmi -ClassName WmiMonitorID -ErrorAction SilentlyContinue | ForEach-Object {
  $label = (Decode-EdidText $_.UserFriendlyName).Trim()
  if ($label -and $_.InstanceName -match 'DISPLAY\\([^\\]+)\\') {
    $script:panelNames[$Matches[1].ToUpper()] = $label
  }
}

function Get-PanelName([string]$device) {
  $adapter = New-Object MonCal+DISPLAY_DEVICE
  $adapter.cb = [Runtime.InteropServices.Marshal]::SizeOf($adapter)
  if (-not [MonCal]::EnumDisplayDevices($device, 0, [ref]$adapter, 0)) { return $null }
  if ($adapter.DeviceID -match 'MONITOR\\([^\\]+)\\') {
    $key = $Matches[1].ToUpper()
    if ($script:panelNames.ContainsKey($key)) { return $script:panelNames[$key] }
  }
  $text = ([string]$adapter.DeviceString).Trim()
  if ($text -and $text -notmatch 'Generic|PnP') { return $text }
  return $null
}

function Disable-Hdr([string]$device) {
  $changed = New-Object System.Collections.Generic.List[string]
  $pathCount = [uint32]0
  $modeCount = [uint32]0
  if ([MonCal]::GetDisplayConfigBufferSizes(2, [ref]$pathCount, [ref]$modeCount) -ne 0 -or $pathCount -lt 1) { return $changed }
  $paths = New-Object MonCal+PATH_INFO[] ([int]$pathCount)
  $modes = New-Object MonCal+MODE_INFO[] ([int]$modeCount)
  if ([MonCal]::QueryDisplayConfig(2, [ref]$pathCount, $paths, [ref]$modeCount, $modes, [IntPtr]::Zero) -ne 0) { return $changed }
  $wanted = if ([string]::IsNullOrWhiteSpace($device)) { '' } else { $device.Trim() }
  for ($i = 0; $i -lt [int]$pathCount; $i++) {
    $nameHeader = New-Object MonCal+DEVICE_HEADER
    $nameHeader.type = [uint32]1
    $nameHeader.size = [uint32][Runtime.InteropServices.Marshal]::SizeOf([type][MonCal+SOURCE_NAME])
    $nameHeader.adapterId = $paths[$i].sourceInfo.adapterId
    $nameHeader.id = $paths[$i].sourceInfo.id
    $source = New-Object MonCal+SOURCE_NAME
    $source.header = $nameHeader
    if ([MonCal]::DisplayConfigGetDeviceInfo([ref]$source) -ne 0) { continue }
    if ($wanted -and $source.viewGdiDeviceName -ne $wanted) { continue }
    $colorHeader = New-Object MonCal+DEVICE_HEADER
    $colorHeader.type = [uint32]9
    $colorHeader.size = [uint32][Runtime.InteropServices.Marshal]::SizeOf([type][MonCal+COLOR_INFO])
    $colorHeader.adapterId = $paths[$i].targetInfo.adapterId
    $colorHeader.id = $paths[$i].targetInfo.id
    $color = New-Object MonCal+COLOR_INFO
    $color.header = $colorHeader
    if ([MonCal]::DisplayConfigGetDeviceInfo([ref]$color) -ne 0) { continue }
    if (($color.value -band 2) -eq 0) { continue }
    $setHeader = New-Object MonCal+DEVICE_HEADER
    $setHeader.type = [uint32]10
    $setHeader.size = [uint32][Runtime.InteropServices.Marshal]::SizeOf([type][MonCal+SET_COLOR])
    $setHeader.adapterId = $paths[$i].targetInfo.adapterId
    $setHeader.id = $paths[$i].targetInfo.id
    $set = New-Object MonCal+SET_COLOR
    $set.header = $setHeader
    $set.enableAdvancedColor = [uint32]0
    if ([MonCal]::DisplayConfigSetDeviceInfo([ref]$set) -eq 0) { [void]$changed.Add($source.viewGdiDeviceName) }
  }
  return $changed
}

$script:hdrOff = @()
try { $script:hdrOff = @(Disable-Hdr '') } catch { $script:hdrOff = @() }
if ($script:hdrOff.Count -gt 0) { Start-Sleep -Milliseconds 700 }

$script:found = @()
$script:seenDevice = @{}
$callback = [MonCal+MonitorEnumProc]{
  param($hMonitor, $hdc, $lprc, $data)
  $info = New-Object MonCal+MONITORINFOEX
  $info.cbSize = [Runtime.InteropServices.Marshal]::SizeOf($info)
  [void][MonCal]::GetMonitorInfo($hMonitor, [ref]$info)
  $deviceKey = [string]$info.szDevice
  if (-not $deviceKey -or $script:seenDevice.ContainsKey($deviceKey)) { return $true }
  $script:seenDevice[$deviceKey] = $true
  $count = 0
  $physical = @()
  if ([MonCal]::GetNumberOfPhysicalMonitorsFromHMONITOR($hMonitor, [ref]$count) -and $count -gt 0) {
    $physical = New-Object MonCal+PHYSICAL_MONITOR[] ([int]$count)
    [void][MonCal]::GetPhysicalMonitorsFromHMONITOR($hMonitor, $count, $physical)
  }
  $script:found += @{ device = $deviceKey; handle = $hMonitor; physical = $physical; count = [int]$count }
  return $true
}
[void][MonCal]::EnumDisplayMonitors([IntPtr]::Zero, [IntPtr]::Zero, $callback, [IntPtr]::Zero)

$items = @()
foreach ($monitor in $script:found) {
  $refresh = Get-Refresh $monitor.device ($action -eq 'calibrate')
  $name = Get-PanelName $monitor.device
  if ([string]::IsNullOrWhiteSpace($name)) { $name = $monitor.device }
  $brightness = $null
  $contrast = $null
  $steps = @()
  $note = $null
  $pictureOk = $false
  $handle = [IntPtr]::Zero
  if ($monitor.count -gt 0) {
    $handle = $monitor.physical[0].hPhysicalMonitor
    if ($name -eq $monitor.device) {
      $fallback = $monitor.physical[0].szPhysicalMonitorDescription
      if (-not [string]::IsNullOrWhiteSpace($fallback)) { $name = $fallback }
    }
  }

  if ($action -eq 'calibrate' -and ($script:hdrOff -contains $monitor.device)) {
    $steps += @{ label = 'HDR выключен'; ok = $true }
  }
  if ($action -eq 'calibrate' -and $refresh.max) {
    $steps += @{ label = "$($refresh.max) Гц"; ok = [bool]$refresh.applied }
  }

  if ($handle -ne [IntPtr]::Zero) {
    $caps = ''
    try { $caps = Get-Caps $handle } catch { $caps = '' }
    $supports = { param($code) $caps -match "(^|[^0-9A-Fa-f])$code([^0-9A-Fa-f]|$)" }

    if ($action -eq 'calibrate') {
      $colorOk = $true
      if (& $supports '08') {
        $colorOk = Write-Vcp $handle 0x08 1
        Start-Sleep -Milliseconds 250
      }
      $fps = Get-FpsCode $caps
      if ($null -eq $fps -and ($caps -eq '' -or (& $supports 'DC'))) { $fps = 4 }
      $fpsOk = $false
      if ($null -ne $fps) {
        $fpsOk = Write-Vcp $handle 0xDC ([uint32]$fps)
        Start-Sleep -Milliseconds 350
      }
      $level = 100
      $brightOk = Write-Vcp $handle 0x10 ([uint32]$level)
      $contrastOk = Write-Vcp $handle 0x12 ([uint32]$level)
      Start-Sleep -Milliseconds 150
      $steps += @{ label = 'Сброс цвета'; ok = [bool]$colorOk }
      $steps += @{ label = 'GameVisual FPS'; ok = [bool]$fpsOk }
      $steps += @{ label = 'Яркость 100'; ok = [bool]$brightOk }
      $steps += @{ label = 'Контраст 100'; ok = [bool]$contrastOk }
      $pictureOk = $brightOk -and $contrastOk
      if (-not $fpsOk) { $note = 'Режим FPS монитор не принял' }
      elseif (-not $pictureOk) { $note = 'Яркость или контраст не применились' }
    }

    $b = Read-Vcp $handle 0x10
    $c = Read-Vcp $handle 0x12
    if ($b) { $brightness = $b.current }
    if ($c) { $contrast = $c.current }
    if ($action -eq 'list' -and -not $b -and -not $c) { $note = 'Монитор не отвечает по DDC/CI' }
  } elseif ($action -eq 'calibrate') {
    $note = 'Нет доступа к настройкам картинки'
    $steps += @{ label = 'Картинка'; ok = $false }
  }

  if ($monitor.count -gt 0) {
    [void][MonCal]::DestroyPhysicalMonitors([uint32]$monitor.count, $monitor.physical)
  }

  $items += [pscustomobject]@{
    name = $name
    resolution = $(if ($refresh.width) { "$($refresh.width)x$($refresh.height)" } else { '-' })
    refreshRate = $refresh.hz
    maxRefreshRate = $refresh.max
    brightness = $brightness
    contrast = $contrast
    ok = $(if ($action -eq 'list') { $true } else { @($steps | Where-Object { -not $_.ok }).Count -eq 0 })
    note = $note
    steps = @($steps | ForEach-Object { [pscustomobject]$_ })
  }
}

if ($items.Count -eq 0) { '[]'; exit 0 }
$chunks = foreach ($item in $items) { $item | ConvertTo-Json -Compress -Depth 5 }
'[' + ($chunks -join ',') + ']'
