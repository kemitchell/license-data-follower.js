var ChangesStream = require('changes-stream')
var Transform = require('./')
var http = require('http')
var level = require('level')
var lexint = require('lexicographic-integer')
var pino = require('pino')
var url = require('url')

var logger = pino()

var levelup = level(
  process.env.LEVELDB || 'license-follower.leveldb',
  {valueEncoding: 'json'}
)

var changes = new ChangesStream({
  db: 'https://replicate.npmjs.com',
  include_docs: true,
  since: process.argv[2] ? parseInt(process.argv[2]) : 0
})

changes
.once('error', function (error) {
  logger.fatal(error)
})
.pipe(new Transform())
.on('data', function (data) {
  var name = data.name
  var version = data.version
  var sequence = data.sequence
  var key = encode(name, version, sequence)
  var value = {
    name: name,
    version: version,
    sequence: sequence,
    hasLicense: data.hasLicense,
    license: data.license
  }
  levelup.put(key, value, function (error) {
    if (error) {
      logger.error(error)
    } else {
      logger.info({
        name: name,
        version: version,
        sequence: sequence
      }, 'wrote')
    }
  })
})

var PACKAGE_PATH = new RegExp(
  '^' +
  '/package' +
  '/([^/]+)' +
  '/([^/]+)' +
  '(/([1-9][0-9]+))?' +
  '$'
)

http.createServer(function (request, response) {
  var parsed = url.parse(request.url)
  var pathname = parsed.pathname
  var match = PACKAGE_PATH.exec(pathname)
  if (match) {
    var name = decodeURIComponent(match[1])
    var version = decodeURIComponent(match[2])
    var sequence = match[4] ? parseInt(match[4]) : undefined
    query(name, version, sequence, function (error, info) {
      if (error) {
        response.statusCode = 500
        response.end()
      } else {
        if (!info) {
          notFound()
        } else {
          response.statusCode = 200
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify(info))
        }
      }
    })
  } else {
    notFound()
  }
  function notFound () {
    response.statusCode = 404
    response.end()
  }
})
.listen(process.env.PORT || 8080, function () {
  logger.info({event: 'listening', port: this.address().port})
})

function query (name, version, sequence, callback) {
  if (sequence !== undefined) {
    var key = encode(name, version, sequence)
    levelup.get(key, function (error, data) {
      if (error) {
        if (error.notFound) {
          callback()
        } else {
          callback(error)
        }
      } else {
        callback(null, data)
      }
    })
  } else {
    var calledBack = false
    levelup.createReadStream({
      gt: encode(name, version, ''),
      lt: encode(name, version, '~'),
      keys: false,
      values: true,
      reverse: true,
      limit: 1
    })
    .once('error', function (error) {
      callback(error)
    })
    .on('data', function (data) {
      calledBack = true
      callback(null, data)
    })
    .once('end', function () {
      if (!calledBack) {
        callback()
      }
    })
  }
}

function encode () {
  return Array.prototype.slice.call(arguments)
  .map(function (element) {
    if (typeof element === 'number') {
      return lexint.pack(element, 'hex')
    } else {
      return encodeURIComponent(element)
    }
  })
  .join('/')
}
