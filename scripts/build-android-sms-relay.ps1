[CmdletBinding()]
param(
    [string]$SdkRoot = 'C:/Unity/Editors/6000.3.21f1/Editor/Data/PlaybackEngines/AndroidPlayer/SDK',
    [string]$JdkRoot = 'C:/Unity/Editors/6000.3.21f1/Editor/Data/PlaybackEngines/AndroidPlayer/OpenJDK',
    [switch]$TestsOnly
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$relayRepo = (Resolve-Path -LiteralPath (Split-Path -Parent $PSScriptRoot)).Path
$relaySource = Join-Path $relayRepo 'native/android-sms-relay'
$relayTools = Join-Path $SdkRoot 'build-tools/36.0.0'
$relayPlatform = Join-Path $SdkRoot 'platforms/android-36/android.jar'
$relayJava = Join-Path $JdkRoot 'bin/java.exe'
$relayJavac = Join-Path $JdkRoot 'bin/javac.exe'
$relayJar = Join-Path $JdkRoot 'bin/jar.exe'
$relayKeytool = Join-Path $JdkRoot 'bin/keytool.exe'
$relayAapt = Join-Path $relayTools 'aapt2.exe'
$relayD8 = Join-Path $relayTools 'lib/d8.jar'
$relaySigner = Join-Path $relayTools 'lib/apksigner.jar'
$relayAlign = Join-Path $relayTools 'zipalign.exe'
$relayLambda = Join-Path $relayTools 'core-lambda-stubs.jar'
foreach ($relayRequired in @($relayPlatform,$relayJava,$relayJavac,$relayJar,$relayKeytool,$relayAapt,$relayD8,$relaySigner,$relayAlign,$relayLambda)) {
    if (-not (Test-Path -LiteralPath $relayRequired -PathType Leaf)) { throw "Required installed tool missing: $relayRequired" }
}
# Every run uses a new owned directory. No recursive delete/move, SDK download, or package install.
$relayRun = Join-Path $relaySource ('build/' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8))
foreach ($relayFolder in @($relayRun,(Join-Path $relayRun 'classes'),(Join-Path $relayRun 'tests'),(Join-Path $relayRun 'res'),(Join-Path $relayRun 'dex'))) {
    New-Item -ItemType Directory -Path $relayFolder -Force | Out-Null
}
function Invoke-RelayTool {
    param([string]$File,[string[]]$Arguments)
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Installed tool failed ($LASTEXITCODE): $File" }
}
$relayAppFiles = @(Get-ChildItem -LiteralPath (Join-Path $relaySource 'src') -Recurse -File -Filter '*.java' | ForEach-Object { $_.FullName })
Invoke-RelayTool -File $relayJavac -Arguments (@('-encoding','UTF-8','-source','8','-target','8','-bootclasspath',($relayPlatform+[IO.Path]::PathSeparator+$relayLambda),'-d',(Join-Path $relayRun 'classes')) + $relayAppFiles)
$relayTestFiles = @(Get-ChildItem -LiteralPath (Join-Path $relaySource 'tests') -File -Filter '*.java' | ForEach-Object { $_.FullName })
# Host-only Android preferences/scheduler doubles; never packaged in the APK.
# Compile the real RelayConfig so the restart/old-failure race exercises its lock and mutations.
$relayStubSources = @{
    'android/Manifest.java' = @'
package android;
public final class Manifest { public static final class permission {
 public static final String READ_SMS="read", RECEIVE_SMS="receive", SEND_SMS="send";
} }
'@
    'android/content/pm/PackageManager.java' = @'
package android.content.pm;
public final class PackageManager { public static final int PERMISSION_GRANTED=0; }
'@
    'android/content/SharedPreferences.java' = @'
package android.content;
import java.util.Set;
public interface SharedPreferences {
 String getString(String k,String d); long getLong(String k,long d); boolean getBoolean(String k,boolean d); Set<String> getStringSet(String k,Set<String> d); Editor edit();
 interface Editor { Editor putString(String k,String v); Editor putLong(String k,long v); Editor putBoolean(String k,boolean v); Editor putStringSet(String k,Set<String> v); Editor remove(String k); boolean commit(); }
}
'@
    'android/content/Context.java' = @'
package android.content;
import java.util.*;
public class Context {
 public static final int MODE_PRIVATE=0; public boolean permissionGranted=true;
 private final Memory preferences=new Memory();
 public SharedPreferences getSharedPreferences(String n,int mode){return preferences;}
 public int checkSelfPermission(String p){return permissionGranted?0:-1;}
 static final class Memory implements SharedPreferences {
  final Map<String,Object> values=new HashMap<>();
  public String getString(String k,String d){return (String)values.getOrDefault(k,d);}
  public long getLong(String k,long d){return (Long)values.getOrDefault(k,d);}
  public boolean getBoolean(String k,boolean d){return (Boolean)values.getOrDefault(k,d);}
  @SuppressWarnings("unchecked") public Set<String> getStringSet(String k,Set<String> d){return new HashSet<>((Set<String>)values.getOrDefault(k,d));}
  public Editor edit(){return new Editor(){
   final Map<String,Object> next=new HashMap<>(values);
   public Editor putString(String k,String v){next.put(k,v);return this;}
   public Editor putLong(String k,long v){next.put(k,v);return this;}
   public Editor putBoolean(String k,boolean v){next.put(k,v);return this;}
   public Editor putStringSet(String k,Set<String> v){next.put(k,new HashSet<>(v));return this;}
   public Editor remove(String k){next.remove(k);return this;}
   public boolean commit(){values.clear();values.putAll(next);return true;}
  };}
 }
}
'@
    'com/tllhouse/hlbreplay/RelayScheduler.java' = @'
package com.tllhouse.hlbreplay;
import android.content.Context;
final class RelayScheduler { static int cancellations; static void cancel(Context c){cancellations++;} }
'@
}
$relayStubFiles = @()
foreach ($relayStub in $relayStubSources.GetEnumerator()) {
    $relayStubPath = Join-Path $relayRun ('host-stubs/' + $relayStub.Key)
    New-Item -ItemType Directory -Path (Split-Path -Parent $relayStubPath) -Force | Out-Null
    [IO.File]::WriteAllText($relayStubPath,$relayStub.Value,[Text.UTF8Encoding]::new($false))
    $relayStubFiles += $relayStubPath
}
Invoke-RelayTool -File $relayJavac -Arguments (@('-encoding','UTF-8','--release','8','-d',(Join-Path $relayRun 'tests'),
    (Join-Path $relaySource 'src/com/tllhouse/hlbreplay/RelayPolicy.java'),(Join-Path $relaySource 'src/com/tllhouse/hlbreplay/SendCoordinator.java'),
    (Join-Path $relaySource 'src/com/tllhouse/hlbreplay/RelayConfig.java')) + $relayStubFiles + $relayTestFiles)
Invoke-RelayTool -File $relayJava -Arguments @('-cp',(Join-Path $relayRun 'tests'),'com.tllhouse.hlbreplay.RelayCoreTest')
if ($TestsOnly) { Write-Output "Host checks and Android API compilation passed. Evidence directory: $relayRun"; exit 0 }

Invoke-RelayTool -File $relayAapt -Arguments @('compile','--dir',(Join-Path $relaySource 'res'),'-o',(Join-Path $relayRun 'res'))
$relayFlats = @(Get-ChildItem -LiteralPath (Join-Path $relayRun 'res') -File -Filter '*.flat' | ForEach-Object { $_.FullName })
$relayUnsigned = Join-Path $relayRun 'unsigned.apk'
Invoke-RelayTool -File $relayAapt -Arguments (@('link','-I',$relayPlatform,'--manifest',(Join-Path $relaySource 'AndroidManifest.xml'),
    '--min-sdk-version','26','--target-sdk-version','36','--version-code','1','--version-name','1.0','-o',$relayUnsigned) + $relayFlats)
$relayClassesJar = Join-Path $relayRun 'classes.jar'
Invoke-RelayTool -File $relayJar -Arguments @('--create','--file',$relayClassesJar,'-C',(Join-Path $relayRun 'classes'),'.')
Invoke-RelayTool -File $relayJava -Arguments @('-cp',$relayD8,'com.android.tools.r8.D8','--release','--min-api','26','--lib',$relayPlatform,'--output',(Join-Path $relayRun 'dex'),$relayClassesJar)
Invoke-RelayTool -File $relayJar -Arguments @('--update','--file',$relayUnsigned,'-C',(Join-Path $relayRun 'dex'),'classes.dex')
$relayAligned = Join-Path $relayRun 'aligned.apk'
Invoke-RelayTool -File $relayAlign -Arguments @('-f','-p','4',$relayUnsigned,$relayAligned)

$relayArtifacts = Join-Path $relayRepo 'work/sms-flex-bridge'
$relayPrivate = Join-Path $relayArtifacts 'private-signing'
$relayPrivateFull = [System.IO.Path]::GetFullPath($relayPrivate)
if (-not $relayPrivateFull.StartsWith(([System.IO.Path]::GetFullPath($relayRepo) + [System.IO.Path]::DirectorySeparatorChar),[StringComparison]::OrdinalIgnoreCase)) { throw 'Signing path outside intended workspace' }
New-Item -ItemType Directory -Path $relayPrivateFull -Force | Out-Null
$relayIgnore = Join-Path $relayPrivateFull '.gitignore'
[System.IO.File]::WriteAllText($relayIgnore,"*`n",[System.Text.UTF8Encoding]::new($false))
# Do not permit signing material to be tracked, even if a caller force-added an earlier key.
Push-Location -LiteralPath $relayRepo
try {
    $relayTracked = @(git ls-files -- 'work/sms-flex-bridge/private-signing/')
    if ($LASTEXITCODE -ne 0 -or $relayTracked.Count -gt 0) { throw 'Signing material path is tracked or Git cannot verify it' }
    git check-ignore --quiet -- 'work/sms-flex-bridge/private-signing/relay-release.p12'
    if ($LASTEXITCODE -ne 0) { throw 'Signing key is not Git-ignored' }
} finally { Pop-Location }
$relayIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$relayAcl = [System.Security.AccessControl.DirectorySecurity]::new()
$relayAcl.SetAccessRuleProtection($true,$false)
$relayRule = [System.Security.AccessControl.FileSystemAccessRule]::new($relayIdentity,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
$relayAcl.SetAccessRule($relayRule)
# Apply only DACL sections; Get-Acl/Set-Acl can copy audit/owner sections and request SeSecurityPrivilege.
$relayDirectory = [System.IO.DirectoryInfo]::new($relayPrivateFull)
if ($PSVersionTable.PSVersion.Major -ge 7) { [System.IO.FileSystemAclExtensions]::SetAccessControl($relayDirectory,$relayAcl) }
else { $relayDirectory.SetAccessControl($relayAcl) }
$relayKeystore = Join-Path $relayPrivateFull 'relay-release.p12'
$relayPasswordFile = Join-Path $relayPrivateFull 'password.dpapi'
$relayOldPassword = [Environment]::GetEnvironmentVariable('HLB_SMS_SIGN_PASSWORD','Process')
try {
    if ((Test-Path -LiteralPath $relayKeystore) -ne (Test-Path -LiteralPath $relayPasswordFile)) { throw 'Incomplete private signing state; preserve it and restore matching key/password' }
    if (-not (Test-Path -LiteralPath $relayKeystore)) {
        $relayRandom = New-Object byte[] 32
        $relayRng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        try { $relayRng.GetBytes($relayRandom) } finally { $relayRng.Dispose() }
        $relayPassword = [Convert]::ToBase64String($relayRandom)
        $relaySecure = ConvertTo-SecureString -String $relayPassword -AsPlainText -Force
        $relaySecure | ConvertFrom-SecureString | Set-Content -LiteralPath $relayPasswordFile -Encoding Ascii
        [Environment]::SetEnvironmentVariable('HLB_SMS_SIGN_PASSWORD',$relayPassword,'Process')
        Invoke-RelayTool -File $relayKeytool -Arguments @('-genkeypair','-keystore',$relayKeystore,'-storetype','PKCS12',
            '-storepass:env','HLB_SMS_SIGN_PASSWORD','-keypass:env','HLB_SMS_SIGN_PASSWORD','-alias','hlb-sms-owner',
            '-keyalg','RSA','-keysize','3072','-validity','3650','-dname','CN=HLB Owner SMS Relay, O=TLL House, C=KR','-noprompt')
    } else {
        $relaySecure = ConvertTo-SecureString -String (Get-Content -LiteralPath $relayPasswordFile -Raw).Trim()
        $relayPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($relaySecure)
        try { $relayPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($relayPointer) }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($relayPointer) }
        [Environment]::SetEnvironmentVariable('HLB_SMS_SIGN_PASSWORD',$relayPassword,'Process')
    }
    $relaySigned = Join-Path $relayRun 'hlb-sms-relay.apk'
    Invoke-RelayTool -File $relayJava -Arguments @('-jar',$relaySigner,'sign','--ks',$relayKeystore,'--ks-key-alias','hlb-sms-owner',
        '--ks-pass','env:HLB_SMS_SIGN_PASSWORD','--key-pass','env:HLB_SMS_SIGN_PASSWORD','--v4-signing-enabled','false','--out',$relaySigned,$relayAligned)
    $relaySignature = & $relayJava '-jar' $relaySigner 'verify' '--verbose' '--print-certs' $relaySigned
    if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed' }
    $relaySignature | Set-Content -LiteralPath (Join-Path $relayRun 'signature.txt') -Encoding UTF8
    $relaySignature | Write-Output
    Invoke-RelayTool -File $relayAlign -Arguments @('-c','-p','4',$relaySigned)
    $relayBadging = & $relayAapt 'dump' 'badging' $relaySigned
    if ($LASTEXITCODE -ne 0) { throw 'APK manifest inspection failed' }
    if ($relayBadging -match '^application-debuggable') { throw 'Refusing to output a debuggable APK' }
    $relayBadging | Set-Content -LiteralPath (Join-Path $relayRun 'badging.txt') -Encoding UTF8
    $relayBadging | Write-Output
    $relayOutput = Join-Path $relayArtifacts 'hlb-sms-relay.apk'
    Copy-Item -LiteralPath $relaySigned -Destination $relayOutput -Force
    $relaySha = (Get-FileHash -LiteralPath $relayOutput -Algorithm SHA256).Hash.ToLowerInvariant()
    $relayReceipt = [ordered]@{
        apk=$relayOutput; apkSha256=$relaySha; builtAtUtc=[DateTime]::UtcNow.ToString('o'); evidence=$relayRun;
        androidPlatform=36; targetSdk=36; minSdk=26; sdk=$SdkRoot; jdk=$JdkRoot;
        hostValidation='Android source compilation and RelayCoreTest passed'; physicalDevice='UNVERIFIED; no installation or SMS test performed';
        sourceFiles=@(($relayAppFiles + $relayTestFiles + @((Join-Path $relaySource 'AndroidManifest.xml'),(Join-Path $relaySource 'res/xml/data_extraction_rules.xml'),$PSCommandPath)) | ForEach-Object { [ordered]@{ path=$_.Substring($relayRepo.Length+1); sha256=(Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash.ToLowerInvariant() } });
    }
    $relayReceipt | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $relayRun 'build-receipt.json') -Encoding UTF8
    Write-Output "APK: $relayOutput"
    Write-Output "APK SHA-256: $relaySha"
    Write-Output "Evidence: $relayRun"
} finally {
    [Environment]::SetEnvironmentVariable('HLB_SMS_SIGN_PASSWORD',$relayOldPassword,'Process')
    $relayPassword=$null; $relaySecure=$null
}
