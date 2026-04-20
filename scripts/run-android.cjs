/**
 * Ensures JAVA_HOME (and ANDROID_HOME on Windows) so Gradle can run.
 * See ANDROID_EMULATOR_SETUP.md at repo root.
 *
 * On Windows, Expo CLI always passes -PreactNativeArchitectures=x86_64,arm64-v8a, which
 * overrides Gradle env vars and breaks native builds (Ninja / long paths). We install via
 * gradlew with a single ABI instead. Set EXPO_ANDROID_ALL_ABIS=1 to use Expo's normal flow.
 */
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const env = { ...process.env }
const win = process.platform === 'win32'
const ANDROID_PKG = 'com.brrrkyle.wonderport'

function javaHome() {
  if (env.JAVA_HOME) {
    const exe = path.join(env.JAVA_HOME, 'bin', win ? 'java.exe' : 'java')
    if (fs.existsSync(exe)) return env.JAVA_HOME
  }
  const candidates = win
    ? [
        String.raw`C:\Program Files\Android\Android Studio\jbr`,
        String.raw`C:\Program Files\Android\Android Studio\jre`,
      ]
    : ['/Applications/Android Studio.app/Contents/jbr/Contents/Home']
  for (const c of candidates) {
    const exe = path.join(c, 'bin', win ? 'java.exe' : 'java')
    if (fs.existsSync(exe)) return c
  }
  return null
}

const jh = javaHome()
if (jh) {
  env.JAVA_HOME = jh
  const sep = path.delimiter
  env.PATH = `${path.join(jh, 'bin')}${sep}${env.PATH || ''}`
}

if (!env.ANDROID_HOME && win) {
  const sdk = path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk')
  if (fs.existsSync(sdk)) env.ANDROID_HOME = sdk
}

const cwd = path.join(__dirname, '..')
const androidDir = path.join(cwd, 'android')
const gradlew = path.join(androidDir, win ? 'gradlew.bat' : 'gradlew')

function runWindowsGradleInstall() {
  if (!env.ANDROID_HOME) {
    console.error('[run-android] ANDROID_HOME is not set and could not be inferred.')
    process.exit(1)
  }
  if (!fs.existsSync(gradlew)) {
    console.error('[run-android] Missing', gradlew)
    process.exit(1)
  }

  const gradleArgs = [
    'installDebug',
    '--no-daemon',
    '--configure-on-demand',
    '--build-cache',
    '-x',
    'lint',
    '-x',
    'test',
    '-PreactNativeDevServerPort=8081',
    '-PreactNativeArchitectures=x86_64',
  ]

  const build = spawnSync(gradlew, gradleArgs, {
    cwd: androidDir,
    env,
    stdio: 'inherit',
    shell: win,
  })
  if (build.status !== 0) {
    process.exit(build.status === null ? 1 : build.status)
  }

  const adb = path.join(env.ANDROID_HOME, 'platform-tools', win ? 'adb.exe' : 'adb')
  if (fs.existsSync(adb)) {
    spawnSync(adb, ['shell', 'monkey', '-p', ANDROID_PKG, '-c', 'android.intent.category.LAUNCHER', '1'], {
      env,
      stdio: 'inherit',
      shell: win,
    })
  }

  console.log('\n[run-android] Dev client installed (' + ANDROID_PKG + '). Start Metro:\n  pnpm exec expo start --dev-client -c\n')
  process.exit(0)
}

// Windows + single ABI: bypass Expo so Gradle is not passed x86_64,arm64-v8a.
if (win && env.EXPO_ANDROID_ALL_ABIS !== '1') {
  runWindowsGradleInstall()
}

const usePnpm = fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))
const cmd = usePnpm ? 'pnpm' : 'npx'
const args = usePnpm ? ['exec', 'expo', 'run:android'] : ['expo', 'run:android']

const result = spawnSync(cmd, args, {
  cwd,
  env,
  stdio: 'inherit',
  shell: win,
})

process.exit(result.status === null ? 1 : result.status)
