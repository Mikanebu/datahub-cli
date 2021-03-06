const test = require('ava')
const nock = require('nock')
const sinon = require('sinon')

// ours
const { data } = require('./data.js')
const utils = require('../lib/utils/common')
const info = require('../lib/info.js')

test.before(t => {
  const metadata = nock('https://bits-staging.datapackaged.com')
        .persist()
        .get('/metadata/core/co2-ppm/_v/latest/datapackage.json')
        .replyWithFile(200, './test/fixtures/co2-ppm/datapackage.json')

  const readme = nock('https://bits-staging.datapackaged.com')
        .persist()
        .get('/metadata/core/co2-ppm/_v/latest/README.md')
        .replyWithFile(200, './test/fixtures/co2-ppm/README.md')
})

test.after(t => {
  nock.restore()
})

test.beforeEach(t => {
  t.context.log = console.log
  console.log = sinon.spy()
})

test('gets readme and outputs first paragraph', async t => {
  const result = await info.getInfo('core/co2-ppm')

  t.true(console.log.calledThrice)
  t.true(console.log.firstCall.args[0].includes('CO2 PPM - Trends in Atmospheric Carbon Dioxide.'))
  t.false(console.log.firstCall.args[0].includes('The information on government servers are'))

  console.log.reset()
})

test('gets readme and outputs full content', async t => {
  const result = await info.getInfo('core/co2-ppm')

  t.true(console.log.calledThrice)
  t.true(console.log.thirdCall.args[0].includes('CO2 PPM - Trends in Atmospheric Carbon Dioxide.'))
  t.true(console.log.thirdCall.args[0].includes('The information on government servers are'))

  console.log.reset()
})

test('gets descriptor and outputs list of resources', async t => {
  const result = await info.getInfo('core/co2-ppm')

  t.true(console.log.calledThrice)
  t.true(console.log.secondCall.args[0].includes('co2-mm-mlo'))
  t.true(console.log.secondCall.args[0].includes('co2-annmean-mlo'))
  t.true(console.log.secondCall.args[0].includes('co2-gr-mlo'))
  t.true(console.log.secondCall.args[0].includes('co2-mm-gl'))
  t.true(console.log.secondCall.args[0].includes('co2-annmean-gl'))
  t.true(console.log.secondCall.args[0].includes('co2-gr-gl'))

  console.log.reset()
})

test('gets readme if readme exists in descriptor', async t => {
  const descriptor = {
    readme: 'some test readme'
  }
  const result = await info.getReadme(descriptor, undefined)

  t.is(result, 'some test readme')
})

test('gets readme if data package is on disk', async t => {
  const descriptor = {}
  const result = await info.getReadme(descriptor, undefined)

  t.true(result.includes('# Usage'))
})

test('gets readme if data package is remote', async t => {
  const descriptor = {}
  const readmeUrl = 'https://bits-staging.datapackaged.com/metadata/core/co2-ppm/_v/latest/README.md'
  const result = await info.getReadme(descriptor, readmeUrl)

  t.true(result.includes('CO2 PPM - Trends in Atmospheric Carbon Dioxide.'))
})

test('"data info [-help | -h]" prints out help message for info', async t => {
  console.log = t.context.log

  let result = await data('info', '-help')
  let stdout = result.stdout.split('\n')
  t.true(stdout.length > 1)
  t.true(stdout[1].includes('Preview a Data Package'))

  result = await data('info', '-h')
  stdout = result.stdout.split('\n')
  t.true(stdout.length > 1)
  t.true(stdout[1].includes('Preview a Data Package'))

  result = await data('help', 'info')
  stdout = result.stdout.split('\n')
  t.true(stdout.length > 1)
  t.true(stdout[1].includes('Preview a Data Package'))
})

test('"data info core/co2-ppm" command prints out readme and resource list', async t => {
  console.log = t.context.log

  const result = await data('info', 'core/co2-ppm')
  t.is(result.code, 0)
  const stdout = result.stdout.split('\n')
  t.true(stdout.length > 1)
  t.true(stdout[5].includes('CO2 PPM'))
  t.true(stdout[17].includes('co2-annmean-mlo'))
})
