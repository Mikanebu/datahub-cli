const test = require('ava')
const fs = require('fs')
const get = require('../lib/get.js')
const nock = require('nock')
const tmp = require('tmp')
const utils = require('../lib/utils/common')
const { data } = require('./data.js')

let tmpdir = tmp.dirSync({ template: '/tmp/tmp-XXXXXX' }).name;
let tmpfile = tmp.fileSync({ template: '/tmp/tmp-XXXXXX.file' }).name;

let metadata = {
  "bitstore_url": "https://bits-staging.datapackaged.com/metadata/publisher/package/_v/latest",
  "descriptor": {
    "name": "package",
    "owner": "publisher",
    "resources": [
      {
        "format": "csv",
        "name": "firstResource",
        "path": "test/firsts-resource.csv"
      },
      {
        "format": "csv",
        "name": "secondResource",
        "url": "https://example.com/data/second-resource.csv"
      }
    ]
  }
}


let getDPJson = nock('https://bits-staging.datapackaged.com')
      .persist()
      .get('/metadata/publisher/package/_v/latest' + tmpfile)
      .reply(200, metadata.descriptor)

let getFromBitstoreUrl = nock('https://bits-staging.datapackaged.com')
      .persist()
      .get('/metadata/publisher/package/_v/latest/test/firsts-resource.csv')
      .replyWithFile(200, './test/fixtures/sample.csv')

let getFromSourceUrl = nock('https://example.com')
      .persist()
      .get('/data/second-resource.csv')
      .replyWithFile(200, './test/fixtures/sample.csv')


test('checkDestIsEmpty returns true if dir exists and is empty', t => {
  let tempDirPath = tmpdir.split('/')
      , publisher = tempDirPath[tempDirPath.length - 2]
      , pkg = tempDirPath[tempDirPath.length - 1]
  let res = get.checkDestIsEmpty('/'+publisher, pkg)
  t.true(res)
})

test('checkDestIsEmpty returns true if dir does not exist', t => {
  let tempDirPath = tmpdir.split('/')
      , publisher = tempDirPath[tempDirPath.length - 1]
      , pkg = 'new'
  let res = get.checkDestIsEmpty('/'+publisher, pkg)
  t.true(res)
})

test('checkDestIsEmpty returns false if dir exists and not empty', t => {
  let tempFilePath = tmpfile.split('/')
  let publisher = tempFilePath[tempFilePath.length - 2]
  let res = get.checkDestIsEmpty('/' + publisher, '')
  t.false(res)
})

test('downloadFile function works', async t => {
  let bUrl = 'https://bits-staging.datapackaged.com/metadata/publisher/package/_v/latest'+tmpfile
  let path = tmpfile
  let publisher = '/'+tmpdir.split('/')[1]
  let pkg = 'package'
  let mockBar = {tick: () => {}}
  await get.downloadFile(bUrl, path, publisher, pkg, mockBar)
  t.true(fs.existsSync(publisher, pkg, path))
})


test('get list of download files', t => {
  let exp = [
    {destPath: 'datapackage.json', url: metadata.bitstore_url+'/datapackage.json'},
    {destPath: 'README', url: metadata.bitstore_url+'/README'},
    {destPath: 'README.md', url: metadata.bitstore_url+'/README.md'},
    {destPath: 'README.txt', url: metadata.bitstore_url+'/README.txt'},
    {destPath: "test/firsts-resource.csv", url: metadata.bitstore_url+'/test/firsts-resource.csv'},
    {destPath: "data/second-resource.csv", url: 'https://example.com/data/second-resource.csv'}
  ]
  let res = get.getFilesToDownload(metadata.bitstore_url, metadata.descriptor)
  t.deepEqual(exp, res)
})

test('"data help get" prints help message for get command', async t => {
  const result = await data('help', 'get')

  t.is(result.code, 0)
  const stdout = result.stdout.split('\n')
  t.true(stdout.length > 1)
  t.true(stdout[1].includes('Get a Data Package from DataHub'))
})

test('"data get -h --help" prints help message for get command', async t => {
  let result = await data('get', '-h')

  t.is(result.code, 0)
  let stdout = result.stdout.split('\n')
  t.true(stdout.length > 1)
  t.true(stdout[1].includes('Get a Data Package from DataHub'))

  result = await data('get', '--help')

  t.is(result.code, 0)
  stdout = result.stdout.split('\n')
  t.true(stdout.length > 1)
  t.true(stdout[1].includes('Get a Data Package from DataHub'))
})
