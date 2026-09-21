const { execFileSync } = require('node:child_process')
const { existsSync, readdirSync } = require('node:fs')
const path = require('node:path')

const rcedit = path.join('node_modules', 'electron-winstaller', 'vendor', 'rcedit.exe')
const icon = path.join('build', 'icon.ico')
const files = process.argv.slice(2)

if (!files.length) {
  const unpacked = path.join('dist', 'win-unpacked', 'TrajectClubHelper.exe')
  if (existsSync(unpacked)) files.push(unpacked)
  if (existsSync('dist')) {
    for (const name of readdirSync('dist')) {
      if (name.endsWith('.exe')) files.push(path.join('dist', name))
    }
  }
}

for (const file of files) {
  execFileSync(rcedit, [file, '--set-icon', icon], { stdio: 'inherit' })
}
