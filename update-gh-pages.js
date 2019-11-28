const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const dist = path.join(__dirname, 'dist')

spawnSync('git', ['-C', dist, 'init'], {stdio: 'inherit'})
spawnSync('git', ['-C', dist, 'add', '.'], {stdio: 'inherit'})
spawnSync('git', ['-C', dist, 'commit', '-m', 'update'], {stdio: 'inherit'})
spawnSync('git', ['-C', __dirname, 'fetch', dist, '-f', 'master:gh-pages'], {stdio: 'inherit'})

// TODO: use a tmpdir for .git?
fs.rmdirSync(path.join(dist, '.git'), {recursive: true})