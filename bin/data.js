#!/usr/bin/env node
require("babel-core/register")
const { version } = require('../package.json')
// Native
const { resolve } = require('path')

// Check if the current path exists and throw and error
// if the user is trying to deploy a non-existing path!
// This needs to be done exactly in this place, because
// the utility imports are taking advantage of it
try {
  process.cwd()
} catch (err) {
  if (err.code === 'ENOENT' && err.syscall === 'uv_cwd') {
    console.log(`Current path doesn't exist!`)
  } else {
    console.log(err)
  }
  process.exit(1)
}


// This command will be run if no other sub command is specified
const defaultCommand = 'help'

const commands = new Set([
  defaultCommand,
  'get',
  'push',
  'normalize',
  'norm',
  'purge',
  'config',
  'configure',
  'validate',
  'info',
  'init',
  'login'
])

const aliases = new Map([
  ['configure', 'config'],
  ['norm', 'normalize']
])

let cmd = defaultCommand
let args = process.argv.slice(2)
const index = args.findIndex(a => commands.has(a))

if (args[0] === '-v' || args[0] === '--version') {
  console.log(`Version: ${version}`)
  process.exit()
}

if (index > -1) {
  cmd = args[index]
  args.splice(index, 1)

  if (cmd === 'help') {
    if (index < args.length && commands.has(args[index])) {
      cmd = args[index]
      args.splice(index, 1)
    } else {
      cmd = defaultCommand
    }

    args.unshift('--help')
  }

  cmd = aliases.get(cmd) || cmd
  if (cmd.includes(' ')) {
    const parts = cmd.split(' ')
    cmd = parts.shift()
    args = [].concat(parts, args)
  }
}

const bin = resolve(__dirname, 'data-' + cmd + '.js')

// Prepare process.argv for subcommand
process.argv = process.argv.slice(0, 2).concat(args)

// Load sub command
// With custom parameter to make "pkg" happy
require(bin, 'may-exclude')
