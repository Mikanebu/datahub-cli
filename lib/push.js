const axios = require('axios')
const creds = require('./config')
const crypto = require('crypto')
const fs = require('fs')
const { logger } = require('./utils/log-handler')
const { checkDpIsThere, getToken } = require('./utils/common')
const { spinner } = require('./utils/tools')
const { addResource, writeDp } = require('./init')
const path = require('path')
const request = require('request-promise-native')
const urljoin = require('url-join')
const Datapackage = require('datapackage').Datapackage


const push = async(filePath) => {
  spinner.text = 'Preparing...'
  spinner.start()
  let dpjson
  // get configs
  const config = creds.readConfig()
  if (!config) {
    logger('Config file not found. Setup configurations by running "data config" command.', 'abort', true, spinner)
  }
  // get dpjson
  if(!filePath) {
    if (!checkDpIsThere()) {
      logger('datapckage.json not found!', 'abort', true, spinner)
    }
    dpjson = JSON.parse(fs.readFileSync('datapackage.json').toString())
  } else {
    // prepare temp descriptor for the single file push
    let descriptor = {
        name: filePath.replace(/^.*[\\\/]/, ''),
        resources: []
    }
    const dpObj = await new Datapackage(descriptor)
    try {
      await addResource(filePath, dpObj)
    } catch (err) {
      logger(err.message, `error`, true, spinner)
    }
    await writeDp(dpObj, false)
    dpjson = dpObj._descriptor
  }

  // get token, get file info and signed urls
  const token = await getToken(config)
  const files = getFileList(dpjson)
  const infoForRequest = getFilesForRequest(files, config.username, dpjson.name)
  const fileData = await getFileData(config, infoForRequest, token)
  // upload
  let uploads = []
  files.forEach(file => {
    uploads.push(uploadFile(file, fileData[file]))
  })

  await Promise.all(uploads)
  // do finalize here
  let dataPackageS3Url = urljoin(
    fileData['datapackage.json']['upload_url'],
    fileData['datapackage.json']['upload_query']['key']
  )
  const response = await finalize(config, dataPackageS3Url, token)

  if(response.status !== 'queued') {
    logger('server did not provide upload authorization for files', 'error', true, spinner)
  }
  const message = '🙌  your Data Package is published!\n'
  const url = '🔗  ' + urljoin(config.server, config.username, dpjson.name)
  logger(message + url, 'success', false, spinner)
  // delete temporary created datapackage.json
  if (filePath) {
    fs.unlinkSync('datapackage.json')
  }
}

const getFileData = async (config, fileInfo, token) => {
  spinner.text = 'Authorizing...'
  axios.defaults.headers.common['Auth-Token'] = token
  const res = await axios.post(
    urljoin(config.server,'/api/datastore/authorize'),
      fileInfo).catch(err => {
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        logger(`Not able to connect to ${config.server}`, 'error', true, spinner)
      }
      const statusCodes = [400, 500]
      if (err.response && statusCodes.indexOf(err.response.status) > -1) {
        logger(err.response.data.message, 'error', true, spinner)
      }
      logger(err.message, 'error', true, spinner)
    })
  return res.data.filedata
}

const getFileInfo = (fileName) => {
  let fileType = 'binary/octet-stream'
  if (path.extname(fileName) === '.json'){
    fileType = 'application/json'
  }

  let size, hash
  try {
    size = fs.statSync(fileName).size
    hash = crypto.createHash('md5')
      .update(fs.readFileSync(fileName))
      .digest("base64")
  } catch (err) {
    logger(err.message, 'error', true, spinner)
  }

  return {
    size: size,
    md5: hash,
    type: fileType,
    name: fileName
  }
}

const getFileList = (dpjson) => {
  let fileList = ['datapackage.json']
  const readmes = ['README', 'README.txt', 'README.md']
  const resources = dpjson.resources
  let readme = readmes.filter(readme => {
    return fs.existsSync(readme)
  })
  fileList = fileList.concat(readme)
  resources.forEach(resource => {
    if (resource.path) {
      fileList.push(resource.path)
    }
  })
  return fileList
}

const getFilesForRequest = (files, owner, packageName) => {
  let fileData = {}
  files.forEach(file => {
    fileData[file] = getFileInfo(file)
  })
  let filesForRequest = {
      metadata: {
          owner: owner,
          name: packageName
      },
      filedata: fileData
  }
  return filesForRequest
}

const uploadFile = async (filePath, data) => {
  spinner.text = 'Uploading...'
  // file should be the part of formData
  data.upload_query.file = fs.createReadStream(filePath)
  const postQuery = {
    url: data.upload_url,
    formData: data.upload_query
  }
  try {
    await request.post(postQuery)
  } catch (err) {
    logger(err.message, 'error', true, spinner)
  }
}

const finalize = async (config, dataPackageS3Url, token) => {
  spinner.text = 'Finalizing...'
  const url = urljoin(config.server,'/api/package/upload')
  const headers = {'Auth-Token': token}
  const postQuery = {
    url: url,
    headers: headers,
    json: {
      'datapackage': dataPackageS3Url
    }
  }
  try {
    let response = await request.post(postQuery)
    return response
  } catch (err) {
    logger(err.message, 'error', true, spinner)
  }
}

module.exports.push = push
module.exports.finalize = finalize
module.exports.getFileData = getFileData
module.exports.getFileInfo = getFileInfo
module.exports.getFileList = getFileList
module.exports.getFilesForRequest = getFilesForRequest
module.exports.uploadFile = uploadFile
