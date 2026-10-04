[CmdletBinding()]
param(
    [string]$SdkRoot = 'C:/Unity/Editors/6000.3.21f1/Editor/Data/PlaybackEngines/AndroidPlayer/SDK',
    [string]$JdkRoot = 'C:/Unity/Editors/6000.3.21f1/Editor/Data/PlaybackEngines/AndroidPlayer/OpenJDK',
    [ValidateSet('Apk','Aab','Both')][string]$BuildFormat = 'Apk',
    [ValidateRange(1,2100000000)][int]$VersionCode = 2,
    [ValidateNotNullOrEmpty()][string]$VersionName = '1.1',
    [string]$BundletoolPath,
    # Explicit local promotion only, after all package gates; never a Play upload.
    [switch]$PublishApk,
    [switch]$TestsOnly
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
# npm/Node can inherit PowerShell 7 module paths into Windows PowerShell 5.1.
# Import that process's installed built-ins by exact path; never edit global env.
if ($PSVersionTable.PSVersion.Major -eq 5) {
    foreach ($relayBuiltinModule in @('Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security','Microsoft.PowerShell.Management')) {
        Import-Module -Name (Join-Path $PSHOME ("Modules/$relayBuiltinModule/$relayBuiltinModule.psd1")) -ErrorAction Stop
    }
}
if ($PublishApk -and ($TestsOnly -or $BuildFormat -eq 'Aab')) { throw '-PublishApk requires an APK package build; TestsOnly/Aab cannot replace the reviewed APK' }
$relayRepo = (Resolve-Path -LiteralPath (Split-Path -Parent $PSScriptRoot)).Path
$relaySource = Join-Path $relayRepo 'native/android-sms-relay'
$relayLiveSource = $relaySource
$relayTools = Join-Path $SdkRoot 'build-tools/36.0.0'
$relayPlatform = Join-Path $SdkRoot 'platforms/android-36/android.jar'
$relayJava = Join-Path $JdkRoot 'bin/java.exe'
$relayJavac = Join-Path $JdkRoot 'bin/javac.exe'
$relayJar = Join-Path $JdkRoot 'bin/jar.exe'
$relayKeytool = Join-Path $JdkRoot 'bin/keytool.exe'
$relayJarSigner = Join-Path $JdkRoot 'bin/jarsigner.exe'
$relayAapt = Join-Path $relayTools 'aapt2.exe'
$relayD8 = Join-Path $relayTools 'lib/d8.jar'
$relaySigner = Join-Path $relayTools 'lib/apksigner.jar'
$relayAlign = Join-Path $relayTools 'zipalign.exe'
$relayLambda = Join-Path $relayTools 'core-lambda-stubs.jar'
foreach ($relayRequired in @($relayPlatform,$relayJava,$relayJavac,$relayJar,$relayKeytool,$relayAapt,$relayD8,$relaySigner,$relayAlign,$relayLambda)) {
    if (-not (Test-Path -LiteralPath $relayRequired -PathType Leaf)) { throw "Required installed tool missing: $relayRequired" }
}
# Every run owns its snapshot and artifacts; never overwrite the deployed APK or another worker's run.
$relayArtifacts = Join-Path $relayRepo 'work/android-studio-release/build'
$relayRun = Join-Path $relayArtifacts ((Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8))
foreach ($relayFolder in @($relayRun,(Join-Path $relayRun 'classes'),(Join-Path $relayRun 'tests'),(Join-Path $relayRun 'res'),(Join-Path $relayRun 'dex'))) {
    New-Item -ItemType Directory -Path $relayFolder -Force | Out-Null
}
$relayCommands = [Collections.Generic.List[object]]::new()
function Invoke-RelayTool {
    param([string]$File,[string[]]$Arguments,[switch]$ReturnOutput)
    # Password arguments are environment-variable references only, never password values.
    $relayPreviousPreference = $ErrorActionPreference
    try { $ErrorActionPreference = 'Continue'; $relayToolOutput = @(& $File @Arguments 2>&1); $relayExit = $LASTEXITCODE }
    finally { $ErrorActionPreference = $relayPreviousPreference }
    $relayLog = ('tool-{0:D2}.log' -f $relayCommands.Count)
    $relayToolOutput | ForEach-Object { "$_" } | Set-Content -LiteralPath (Join-Path $relayRun $relayLog) -Encoding UTF8
    $relayCommands.Add([ordered]@{ executable=$File; arguments=$Arguments; exitCode=$relayExit; log=$relayLog })
    $relayCommands | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $relayRun 'commands.json') -Encoding UTF8
    if ($relayExit -ne 0) { throw "Installed tool failed ($relayExit): $File; see $relayLog" }
    if ($ReturnOutput) { return ($relayToolOutput | ForEach-Object { "$_" }) }
    $relayToolOutput | ForEach-Object { Write-Output "$_" }
}
function Get-RelayInputs {
    $relayInputs = @((Join-Path $relayLiveSource 'AndroidManifest.xml'),$PSCommandPath,(Join-Path $relayRepo 'package.json'))
    # The native verifier checks its README and the approved icon's origin.
    foreach ($relayVerifierInput in @((Join-Path $relayLiveSource 'README.md'),(Join-Path $relayRepo 'icon-512.png'))) {
        if (Test-Path -LiteralPath $relayVerifierInput -PathType Leaf) { $relayInputs += $relayVerifierInput }
    }
    $relayBuilderTest = Join-Path $PSScriptRoot 'android-sms-builder.test.mjs'
    if (Test-Path -LiteralPath $relayBuilderTest -PathType Leaf) { $relayInputs += $relayBuilderTest }
    foreach ($relayInputFolder in @('src','tests','res','assets')) {
        $relayInputPath = Join-Path $relayLiveSource $relayInputFolder
        if (Test-Path -LiteralPath $relayInputPath) { $relayInputs += @(Get-ChildItem -LiteralPath $relayInputPath -Recurse -File | ForEach-Object { $_.FullName }) }
    }
    return @($relayInputs | Sort-Object)
}
function Test-RelaySourceSnapshot {
    $relayLiveHashes = @(foreach ($relayInput in (Get-RelayInputs)) {
        [ordered]@{ path=$relayInput.Substring($relayRepo.Length+1).Replace('\','/'); sha256=(Get-FileHash -LiteralPath $relayInput -Algorithm SHA256).Hash.ToLowerInvariant() }
    })
    return (($relaySourceHashes | ConvertTo-Json -Compress) -eq ($relayLiveHashes | ConvertTo-Json -Compress))
}
$relaySnapshotRoot = Join-Path $relayRun 'source'
$relaySourceHashes = @(foreach ($relayInput in (Get-RelayInputs)) {
    $relayRelative = $relayInput.Substring($relayRepo.Length+1).Replace('\','/')
    $relaySnapshot = Join-Path $relaySnapshotRoot $relayRelative
    $relayBeforeHash = (Get-FileHash -LiteralPath $relayInput -Algorithm SHA256).Hash.ToLowerInvariant()
    New-Item -ItemType Directory -Path (Split-Path -Parent $relaySnapshot) -Force | Out-Null
    Copy-Item -LiteralPath $relayInput -Destination $relaySnapshot
    $relayCopiedHash = (Get-FileHash -LiteralPath $relaySnapshot -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($relayBeforeHash -ne $relayCopiedHash -or $relayCopiedHash -ne (Get-FileHash -LiteralPath $relayInput -Algorithm SHA256).Hash.ToLowerInvariant()) { throw "Source changed during snapshot: $relayRelative; retry after writer finishes" }
    [ordered]@{ path=$relayRelative; sha256=$relayCopiedHash }
})
$relaySource = Join-Path $relaySnapshotRoot 'native/android-sms-relay'
$relaySourceHashes | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $relayRun 'source-hashes.json') -Encoding UTF8
if (-not (Test-RelaySourceSnapshot)) { throw 'Source tree changed while assembling snapshot; retry after writer finishes' }
$relayGitHead = (git -C $relayRepo rev-parse HEAD).Trim()
$relayGitBranch = (git -C $relayRepo branch --show-current).Trim()
$relayGitRemote = (git -C $relayRepo remote get-url origin).Trim()
$relayBundletool = $null
$relayBundleVersion = $null
$relayBundleHash = $null
$relayBundleOrigin = 'Caller supplied path; no download'
if (-not $TestsOnly -and $BuildFormat -ne 'Apk') {
    if (-not $BundletoolPath) {
        $relayInstalledBundles = @(Get-ChildItem -LiteralPath (Join-Path (Split-Path -Parent $SdkRoot) 'Tools') -Filter 'bundletool-all-*.jar' -File | Sort-Object Name -Descending)
        if ($relayInstalledBundles.Count -eq 0) { throw 'No installed bundletool. Supply -BundletoolPath to a pinned official Google bundletool JAR; no automatic download or global installation.' }
        $BundletoolPath = $relayInstalledBundles[0].FullName
        $relayBundleOrigin = 'Existing Unity AndroidPlayer/Tools installation; no download'
    }
    $relayBundletool = (Resolve-Path -LiteralPath $BundletoolPath).Path
    if (-not (Test-Path -LiteralPath $relayJarSigner -PathType Leaf)) { throw 'Installed JDK jarsigner missing' }
    $relayBundleVersion = (Invoke-RelayTool -File $relayJava -Arguments @('-jar',$relayBundletool,'version') -ReturnOutput | Out-String).Trim()
    $relayBundleHash = (Get-FileHash -LiteralPath $relayBundletool -Algorithm SHA256).Hash.ToLowerInvariant()
}
$relayHostGroups = @()
$relayNativeVerifier = Join-Path $relaySource 'tests/verify-native.mjs'
$relayNativeVerifierStatus = 'NOT_PRESENT_IN_SNAPSHOT'
$relayNativeEvidence = $null
if (Test-Path -LiteralPath $relayNativeVerifier -PathType Leaf) {
    # The native verifier already API-compiles the entire app and executes both
    # RelayCoreTest and the call groups. Reuse that compile, rather than repeat it.
    $relayNode = (Get-Command node.exe -ErrorAction Stop).Source
    $relayRunnerOutput = @(Invoke-RelayTool -File $relayNode -Arguments @($relayNativeVerifier) -ReturnOutput)
    $relayRunnerOutput | Write-Output
    $relayEvidenceLines = @($relayRunnerOutput | Select-String -Pattern '^Evidence: (.+)$')
    if ($relayEvidenceLines.Count -ne 1) { throw 'Native verifier did not provide one evidence directory' }
    $relayNativeEvidence = [IO.Path]::GetFullPath($relayEvidenceLines[0].Matches[0].Groups[1].Value)
    if (-not $relayNativeEvidence.StartsWith(($relayRun + [IO.Path]::DirectorySeparatorChar),[StringComparison]::OrdinalIgnoreCase)) { throw 'Native verifier evidence is outside this owned build run' }
    $relayNativeResult = Get-Content -LiteralPath (Join-Path $relayNativeEvidence 'result.json') -Raw | ConvertFrom-Json
    if ($relayNativeResult.status -ne 'PASS') { throw 'Native verifier result was not PASS' }
    $relayNativeHashes = Get-Content -LiteralPath (Join-Path $relayNativeEvidence 'source-hashes.json') -Raw | ConvertFrom-Json
    foreach ($relayNativeHash in $relayNativeHashes) {
        $relayMatchingHash = @($relaySourceHashes | Where-Object { $_.path -eq $relayNativeHash.path -and $_.sha256 -eq $relayNativeHash.sha256 })
        if ($relayMatchingHash.Count -ne 1) { throw "Native verifier source differs from package snapshot: $($relayNativeHash.path)" }
    }
    # PS5.1 emits a JSON array as one pipeline object; assignment keeps its actual
    # array rather than wrapping it in an extra array and joining command paths.
    $relayNativeCommands = Get-Content -LiteralPath (Join-Path $relayNativeEvidence 'commands.json') -Raw | ConvertFrom-Json
    if (@($relayNativeCommands | Where-Object { $_.exitCode -ne 0 }).Count -gt 0) { throw 'Native verifier command evidence contains failures' }
    $relayNativeCompile = @($relayNativeCommands | Where-Object { $_.log -eq 'android-api-compile.log' })
    if ($relayNativeCompile.Count -ne 1 -or [IO.Path]::GetFullPath($relayNativeCompile[0].executable) -ne [IO.Path]::GetFullPath($relayJavac) -or
        -not ($relayNativeCompile[0].args -contains ($relayPlatform+[IO.Path]::PathSeparator+$relayLambda))) { throw 'Native compiled classes do not use the requested SDK/JDK; no class reuse performed' }
    $relayNativeClasses = Join-Path $relayNativeEvidence 'android-classes'
    if (-not (Test-Path -LiteralPath (Join-Path $relayNativeClasses 'com/tllhouse/hlbreplay/MainActivity.class') -PathType Leaf)) { throw 'Native API compile did not produce application classes' }
    foreach ($relayClass in (Get-ChildItem -LiteralPath $relayNativeClasses -Recurse -File -Filter '*.class')) {
        $relayClassTarget = Join-Path $relayRun ('classes/' + $relayClass.FullName.Substring($relayNativeClasses.Length+1))
        New-Item -ItemType Directory -Path (Split-Path -Parent $relayClassTarget) -Force | Out-Null
        Copy-Item -LiteralPath $relayClass.FullName -Destination $relayClassTarget
        if ((Get-FileHash -LiteralPath $relayClass.FullName -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $relayClassTarget -Algorithm SHA256).Hash) { throw 'Native class copy hash mismatch' }
    }
    $relayHostGroups += [ordered]@{ name='verify-native.mjs'; result='PASS'; output=$relayRunnerOutput; evidence=$relayNativeEvidence; verified=$relayNativeResult.verified }
    $relayNativeVerifierStatus = 'PASS'
} else {
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
$relayHostSources = @(
    (Join-Path $relaySource 'src/com/tllhouse/hlbreplay/RelayPolicy.java'),(Join-Path $relaySource 'src/com/tllhouse/hlbreplay/SendCoordinator.java'),
    (Join-Path $relaySource 'src/com/tllhouse/hlbreplay/RelayConfig.java'))
Invoke-RelayTool -File $relayJavac -Arguments (@('-encoding','UTF-8','--release','8','-d',(Join-Path $relayRun 'tests')) + $relayHostSources + $relayStubFiles + $relayTestFiles)
$relayHostGroups = @()
foreach ($relayTestFile in $relayTestFiles) {
    $relayTestText = [IO.File]::ReadAllText($relayTestFile)
    if ($relayTestText -match '\bpublic\s+static\s+void\s+main\s*\(' -and $relayTestText -match '\bpackage\s+([\w.]+)\s*;') {
        $relayTestClass = $Matches[1] + '.' + [IO.Path]::GetFileNameWithoutExtension($relayTestFile)
        $relayTestOutput = @(Invoke-RelayTool -File $relayJava -Arguments @('-cp',(Join-Path $relayRun 'tests'),$relayTestClass) -ReturnOutput)
        $relayTestOutput | Write-Output
        $relayHostGroups += [ordered]@{ name=$relayTestClass; result='PASS'; output=$relayTestOutput }
    }
}
if ($relayHostGroups.Count -eq 0) { throw 'No executable host test groups discovered' }
}

function Write-RelayReceipt {
    param([object[]]$Packages,[string]$Validation)
    $relaySourceUnchanged = Test-RelaySourceSnapshot
    $relayReceipt = [ordered]@{
        schemaVersion=2; buildFormat=$BuildFormat; testsOnly=[bool]$TestsOnly; builtAtUtc=[DateTime]::UtcNow.ToString('o');
        evidence=$relayRun; git=[ordered]@{ remote=$relayGitRemote; branch=$relayGitBranch; head=$relayGitHead };
        packageName='com.tllhouse.hlbreplay'; versionCode=$VersionCode; versionName=$VersionName;
        androidPlatform=36; targetSdk=36; minSdk=26; sdk=$SdkRoot; jdk=$JdkRoot;
        hostValidation='Android source compilation and all discovered host test groups passed'; hostTestGroups=$relayHostGroups; nativeVerifier=$relayNativeVerifierStatus; nativeEvidence=$relayNativeEvidence; packageValidation=$Validation;
        physicalDevice='UNVERIFIED; no installation, phone input, SMS or background check performed';
        playAcceptance='UNVERIFIED; no upload, Play signing enrollment, policy review or publishing performed';
        releaseStatus='BUILD_CANDIDATE; parent owns final native-source freeze and integrated acceptance';
        sourceFiles=$relaySourceHashes; sourceSnapshot=$relaySnapshotRoot; liveSourceMatchesSnapshot=$relaySourceUnchanged;
        artifacts=@($Packages); commands=(Join-Path $relayRun 'commands.json');
        publishApkRequested=[bool]$PublishApk; localPublication=$relayPublication;
        tools=@(foreach ($relayToolPath in @($relayJava,$relayJavac,$relayJar,$relayAapt,$relayD8,$relaySigner,$relayAlign)) {
            [ordered]@{ path=$relayToolPath; sha256=(Get-FileHash -LiteralPath $relayToolPath -Algorithm SHA256).Hash.ToLowerInvariant() }
        });
        bundletool=$(if ($relayBundletool) { [ordered]@{ path=$relayBundletool; version=$relayBundleVersion; sha256=$relayBundleHash; origin=$relayBundleOrigin; officialRelease="https://github.com/google/bundletool/releases/tag/$relayBundleVersion"; license='Apache-2.0' } } else { $null });
        runtime=[ordered]@{ threadId=[Environment]::GetEnvironmentVariable('CODEX_THREAD_ID'); sessionId=[Environment]::GetEnvironmentVariable('CODEX_SESSION_ID'); model='UNVERIFIED'; provider='UNVERIFIED'; effort='UNVERIFIED'; account='UNVERIFIED'; usage='UNAVAILABLE' }
    }
    if ($Packages.Count -gt 0) {
        $relayApkArtifact = @($Packages | Where-Object format -EQ 'apk')
        if ($relayApkArtifact.Count) { $relayReceipt.apk=$relayApkArtifact[0].path; $relayReceipt.apkSha256=$relayApkArtifact[0].sha256 }
        $relayAabArtifact = @($Packages | Where-Object format -EQ 'aab')
        if ($relayAabArtifact.Count) { $relayReceipt.aab=$relayAabArtifact[0].path; $relayReceipt.aabSha256=$relayAabArtifact[0].sha256 }
    }
    $relayReceipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $relayRun 'build-receipt.json') -Encoding UTF8
    Write-Output "Receipt: $(Join-Path $relayRun 'build-receipt.json')"
    Write-Output "Live sources still match snapshot: $relaySourceUnchanged"
}
$relayPublication = [ordered]@{ status='NOT_REQUESTED'; reviewedApkUntouched=$true }
if ($TestsOnly) {
    Write-RelayReceipt -Packages @() -Validation 'NOT_RUN; TestsOnly creates no signed application packages; native verifier may produce unsigned resource-check fixtures'
    Write-Output "Host checks and Android API compilation passed. Evidence directory: $relayRun"
    exit 0
}

Invoke-RelayTool -File $relayAapt -Arguments @('compile','--dir',(Join-Path $relaySource 'res'),'-o',(Join-Path $relayRun 'res'))
$relayFlats = @(Get-ChildItem -LiteralPath (Join-Path $relayRun 'res') -File -Filter '*.flat' | ForEach-Object { $_.FullName })
$relayLinkArguments = @('link','-I',$relayPlatform,'--manifest',(Join-Path $relaySource 'AndroidManifest.xml'),
    '--min-sdk-version','26','--target-sdk-version','36','--version-code',"$VersionCode",'--version-name',$VersionName)
$relayAssets = Join-Path $relaySource 'assets'
if (Test-Path -LiteralPath $relayAssets) { $relayLinkArguments += @('-A',$relayAssets) }
$relayClassesJar = Join-Path $relayRun 'classes.jar'
Invoke-RelayTool -File $relayJar -Arguments @('--create','--file',$relayClassesJar,'-C',(Join-Path $relayRun 'classes'),'.')
Invoke-RelayTool -File $relayJava -Arguments @('-cp',$relayD8,'com.android.tools.r8.D8','--release','--min-api','26','--lib',$relayPlatform,'--output',(Join-Path $relayRun 'dex'),$relayClassesJar)
$relayDexFiles = @(Get-ChildItem -LiteralPath (Join-Path $relayRun 'dex') -Filter 'classes*.dex' -File)
if ($relayDexFiles.Count -eq 0) { throw 'D8 produced no application dex files' }
$relaySigned = $null
$relayBundle = $null
if ($BuildFormat -ne 'Aab') {
    $relayUnsigned = Join-Path $relayRun 'unsigned.apk'
    Invoke-RelayTool -File $relayAapt -Arguments ($relayLinkArguments + @('-o',$relayUnsigned) + $relayFlats)
    foreach ($relayDex in $relayDexFiles) { Invoke-RelayTool -File $relayJar -Arguments @('--update','--file',$relayUnsigned,'-C',(Join-Path $relayRun 'dex'),$relayDex.Name) }
    $relayAligned = Join-Path $relayRun 'aligned.apk'
    Invoke-RelayTool -File $relayAlign -Arguments @('-f','-p','4',$relayUnsigned,$relayAligned)
    $relaySigned = Join-Path $relayRun 'hlb-sms-relay.apk'
}
if ($BuildFormat -ne 'Apk') {
    # Official non-Gradle flow: protobuf linked resources -> base module -> bundletool -> jarsigner.
    $relayProto = Join-Path $relayRun 'proto-resources.apk'
    Invoke-RelayTool -File $relayAapt -Arguments ($relayLinkArguments + @('--proto-format','-o',$relayProto) + $relayFlats)
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $relayModule = Join-Path $relayRun 'base-module'
    [IO.Compression.ZipFile]::ExtractToDirectory($relayProto,$relayModule)
    New-Item -ItemType Directory -Path (Join-Path $relayModule 'manifest') -Force | Out-Null
    # Move exactly one owned snapshot artifact, within this unique build run.
    Move-Item -LiteralPath (Join-Path $relayModule 'AndroidManifest.xml') -Destination (Join-Path $relayModule 'manifest/AndroidManifest.xml')
    New-Item -ItemType Directory -Path (Join-Path $relayModule 'dex') -Force | Out-Null
    foreach ($relayDex in $relayDexFiles) { Copy-Item -LiteralPath $relayDex.FullName -Destination (Join-Path $relayModule 'dex') }
    $relayBaseZip = Join-Path $relayRun 'base.zip'
    Invoke-RelayTool -File $relayJar -Arguments @('--create','--no-manifest','--file',$relayBaseZip,'-C',$relayModule,'.')
    $relayBundle = Join-Path $relayRun 'hlb-sms-relay.aab'
    Invoke-RelayTool -File $relayJava -Arguments @('-jar',$relayBundletool,'build-bundle',"--modules=$relayBaseZip","--output=$relayBundle")
}

# Read-only reuse of the existing identity; never generate keys, edit ACLs or rewrite auth files.
$relayPrivate = Join-Path $relayRepo 'work/sms-flex-bridge/private-signing'
$relayKeystore = Join-Path $relayPrivate 'relay-release.p12'
$relayPasswordFile = Join-Path $relayPrivate 'password.dpapi'
if (-not (Test-Path -LiteralPath $relayKeystore -PathType Leaf) -or -not (Test-Path -LiteralPath $relayPasswordFile -PathType Leaf)) {
    throw 'Existing matching private key/password required; signing state was not created or modified'
}
$relayTracked = @(git -C $relayRepo ls-files -- 'work/sms-flex-bridge/private-signing/')
if ($LASTEXITCODE -ne 0 -or $relayTracked.Count -gt 0) { throw 'Signing material path is tracked or Git cannot verify it' }
foreach ($relayIgnoredPath in @('work/sms-flex-bridge/private-signing/relay-release.p12','work/sms-flex-bridge/private-signing/password.dpapi')) {
    git -C $relayRepo check-ignore --quiet -- $relayIgnoredPath
    if ($LASTEXITCODE -ne 0) { throw 'Signing material is not Git-ignored' }
}
$relayOldPassword = [Environment]::GetEnvironmentVariable('HLB_SMS_SIGN_PASSWORD','Process')
$relayPackages = @()
$relaySecure = $null
$relayReviewedApk = Join-Path $relayRepo 'work/sms-flex-bridge/hlb-sms-relay.apk'
$relayReviewedHash = $null
$relayReviewedCertificate = $null
$relayApkCertificate = $null
function Get-RelayApkCertificate {
    param([string]$ApkPath,[string[]]$Verification)
    $relayVerified = @($Verification)
    if (-not $Verification) { $relayVerified = @(Invoke-RelayTool -File $relayJava -Arguments @('-jar',$relaySigner,'verify','--verbose','--print-certs',$ApkPath) -ReturnOutput) }
    $relayCertificateLines = @($relayVerified | Select-String -Pattern '^Signer #1 certificate SHA-256 digest: ([0-9a-fA-F]{64})$')
    if ($relayCertificateLines.Count -ne 1 -or -not ($relayVerified -contains 'Number of signers: 1')) { throw 'Expected one verified APK signing identity' }
    return $relayCertificateLines[0].Matches[0].Groups[1].Value.ToLowerInvariant()
}
if (Test-Path -LiteralPath $relayReviewedApk -PathType Leaf) {
    $relayReviewedHash = (Get-FileHash -LiteralPath $relayReviewedApk -Algorithm SHA256).Hash.ToLowerInvariant()
    $relayReviewedCertificate = Get-RelayApkCertificate -ApkPath $relayReviewedApk
}
if ($PublishApk -and -not $relayReviewedCertificate) { throw 'Cannot promote without the existing reviewed APK identity; existing output was not modified' }
try {
    $relaySecure = ConvertTo-SecureString -String (Get-Content -LiteralPath $relayPasswordFile -Raw).Trim()
    $relayPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($relaySecure)
    try { $relayPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($relayPointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($relayPointer) }
    [Environment]::SetEnvironmentVariable('HLB_SMS_SIGN_PASSWORD',$relayPassword,'Process')
    if ($relaySigned) {
        Invoke-RelayTool -File $relayJava -Arguments @('-jar',$relaySigner,'sign','--ks',$relayKeystore,'--ks-key-alias','hlb-sms-owner',
            '--ks-pass','env:HLB_SMS_SIGN_PASSWORD','--key-pass','env:HLB_SMS_SIGN_PASSWORD','--v4-signing-enabled','false','--out',$relaySigned,$relayAligned)
        $relaySignature = @(Invoke-RelayTool -File $relayJava -Arguments @('-jar',$relaySigner,'verify','--verbose','--print-certs',$relaySigned) -ReturnOutput)
        $relaySignature | Set-Content -LiteralPath (Join-Path $relayRun 'signature.txt') -Encoding UTF8
        $relayApkCertificate = Get-RelayApkCertificate -Verification $relaySignature
        if ($relayReviewedCertificate -and $relayApkCertificate -ne $relayReviewedCertificate) { throw 'APK update identity differs from the existing reviewed APK' }
        Invoke-RelayTool -File $relayAlign -Arguments @('-c','-p','4',$relaySigned)
        $relayBadging = @(Invoke-RelayTool -File $relayAapt -Arguments @('dump','badging',$relaySigned) -ReturnOutput)
        $relayBadging | Set-Content -LiteralPath (Join-Path $relayRun 'badging.txt') -Encoding UTF8
        $relayExpected = "package: name='com.tllhouse.hlbreplay' versionCode='$VersionCode' versionName='$VersionName'"
        if (-not ($relayBadging[0].StartsWith($relayExpected)) -or $relayBadging -match '^application-debuggable' -or
            -not ($relayBadging -match "^(?:minSdkVersion|sdkVersion):'26'$") -or -not ($relayBadging -contains "targetSdkVersion:'36'") -or
            -not ($relayBadging -match "^launchable-activity: name='com.tllhouse.hlbreplay.MainActivity'")) { throw 'APK package/version/SDK/launchable release inspection failed' }
        $relayPackages += [ordered]@{ format='apk'; path=$relaySigned; sha256=(Get-FileHash -LiteralPath $relaySigned -Algorithm SHA256).Hash.ToLowerInvariant(); signerCertificateSha256=$relayApkCertificate; existingReviewedCertificateMatches=($relayReviewedCertificate -eq $relayApkCertificate); signatureVerified=$true; alignmentVerified=$true; manifestVerified=$true }
    }
    if ($relayBundle) {
        Invoke-RelayTool -File $relayJarSigner -Arguments @('-J-Duser.language=en','-keystore',$relayKeystore,'-storetype','PKCS12',
            '-storepass:env','HLB_SMS_SIGN_PASSWORD','-keypass:env','HLB_SMS_SIGN_PASSWORD',
            '-sigalg','SHA256withRSA','-digestalg','SHA-256',$relayBundle,'hlb-sms-owner')
        $relayBundleSignature = @(Invoke-RelayTool -File $relayJarSigner -Arguments @('-J-Duser.language=en','-verify',$relayBundle) -ReturnOutput)
        $relayBundleSignature | Set-Content -LiteralPath (Join-Path $relayRun 'aab-signature.txt') -Encoding UTF8
        if (-not ($relayBundleSignature -match 'jar verified\.')) { throw 'AAB JAR signature was not verified' }
        $relayBundleCertInfo = @(Invoke-RelayTool -File $relayKeytool -Arguments @('-J-Duser.language=en','-printcert','-jarfile',$relayBundle) -ReturnOutput)
        $relayBundleCertLines = @($relayBundleCertInfo | Select-String -Pattern '^\s*SHA256: ([0-9A-Fa-f:]+)$')
        if ($relayBundleCertLines.Count -ne 1) { throw 'Expected one verified AAB signing certificate' }
        $relayBundleCertificate = $relayBundleCertLines[0].Matches[0].Groups[1].Value.Replace(':','').ToLowerInvariant()
        if ($relayReviewedCertificate -and $relayBundleCertificate -ne $relayReviewedCertificate) { throw 'AAB upload identity differs from the existing reviewed APK' }
        if ($relayApkCertificate -and $relayBundleCertificate -ne $relayApkCertificate) { throw 'AAB and APK signing identities differ' }
        Invoke-RelayTool -File $relayJava -Arguments @('-jar',$relayBundletool,'validate',"--bundle=$relayBundle")
        $relayBundleManifest = @(Invoke-RelayTool -File $relayJava -Arguments @('-jar',$relayBundletool,'dump','manifest',"--bundle=$relayBundle",'--module=base') -ReturnOutput)
        $relayManifestText = $relayBundleManifest -join [Environment]::NewLine
        $relayManifestText | Set-Content -LiteralPath (Join-Path $relayRun 'aab-manifest.xml') -Encoding UTF8
        [xml]$relayManifestXml = $relayManifestText
        $relayAndroidNamespace = 'http://schemas.android.com/apk/res/android'
        $relayXmlRoot = $relayManifestXml.DocumentElement
        $relayUsesSdk = $relayXmlRoot.SelectSingleNode('uses-sdk')
        $relayApplication = $relayXmlRoot.SelectSingleNode('application')
        if ($relayXmlRoot.GetAttribute('package') -ne 'com.tllhouse.hlbreplay' -or
            $relayXmlRoot.GetAttribute('versionCode',$relayAndroidNamespace) -ne "$VersionCode" -or
            $relayXmlRoot.GetAttribute('versionName',$relayAndroidNamespace) -ne $VersionName -or
            $relayUsesSdk.GetAttribute('minSdkVersion',$relayAndroidNamespace) -ne '26' -or
            $relayUsesSdk.GetAttribute('targetSdkVersion',$relayAndroidNamespace) -ne '36' -or
            $relayApplication.GetAttribute('debuggable',$relayAndroidNamespace) -eq 'true') { throw 'AAB package/version/SDK/release manifest inspection failed' }
        $relayPackages += [ordered]@{ format='aab'; path=$relayBundle; sha256=(Get-FileHash -LiteralPath $relayBundle -Algorithm SHA256).Hash.ToLowerInvariant(); signerCertificateSha256=$relayBundleCertificate; existingReviewedCertificateMatches=($relayReviewedCertificate -eq $relayBundleCertificate); signatureVerified=$true; bundletoolValidated=$true; manifestVerified=$true }
    }
    Write-RelayReceipt -Packages $relayPackages -Validation 'Release manifests, requested versions/SDKs and signatures verified; APK alignment and/or bundletool validate passed'
    if ($PublishApk) {
        # Promotion is deliberately last: a failed AAB/host gate cannot overwrite the reviewed APK.
        if (-not (Test-RelaySourceSnapshot)) { throw 'Live source differs from candidate; reviewed APK was not modified' }
        if ((Get-FileHash -LiteralPath $relayReviewedApk -Algorithm SHA256).Hash.ToLowerInvariant() -ne $relayReviewedHash) { throw 'Reviewed APK changed during build; promotion aborted' }
        $relayReviewedBadging = @(Invoke-RelayTool -File $relayAapt -Arguments @('dump','badging',$relayReviewedApk) -ReturnOutput)
        if ($relayReviewedBadging[0] -notmatch "^package: name='com.tllhouse.hlbreplay' versionCode='([0-9]+)'" -or $VersionCode -le [int]$Matches[1]) { throw 'Promotion must increase the reviewed APK versionCode' }
        $relayPublishReady = Join-Path $relayRun 'publish-ready.apk'
        $relayRollback = Join-Path $relayRun 'previous-reviewed.apk'
        Copy-Item -LiteralPath $relaySigned -Destination $relayPublishReady
        [IO.File]::Replace($relayPublishReady,$relayReviewedApk,$relayRollback)
        $relayPublication = [ordered]@{ status='PUBLISHED_LOCALLY'; path=$relayReviewedApk; sha256=(Get-FileHash -LiteralPath $relayReviewedApk -Algorithm SHA256).Hash.ToLowerInvariant(); rollback=$relayRollback; previousSha256=$relayReviewedHash; reviewedApkUntouched=$false }
        Write-RelayReceipt -Packages $relayPackages -Validation 'All package gates passed before explicit atomic local APK promotion; no platform upload'
    }
    foreach ($relayPackage in $relayPackages) { Write-Output "$($relayPackage.format.ToUpperInvariant()): $($relayPackage.path)"; Write-Output "SHA-256: $($relayPackage.sha256)" }
} finally {
    [Environment]::SetEnvironmentVariable('HLB_SMS_SIGN_PASSWORD',$relayOldPassword,'Process')
    if ($null -ne $relaySecure) { $relaySecure.Dispose() }
    $relayPassword=$null; $relaySecure=$null
}
