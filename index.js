var Readable = require('readable-stream').Readable
var changesStream = require('changes-stream')
var inherits = require('util').inherits
var pick = require('object.pick')
var pressureStream = require('pressure-stream')
var pump = require('pump')

module.exports = LicenseDataFollower

function LicenseDataFollower (levelup, fromSequence) {
  if (fromSequence !== undefined && !validSequence(fromSequence)) {
    throw new Error('invalid sequence number')
  }
  if (!(this instanceof LicenseDataFollower)) {
    return new LicenseDataFollower(levelup, fromSequence)
  }
  Readable.call(this, {objectMode: true})
  this._fromSequence = fromSequence
  this._levelup = levelup
  this._sequence = 0
}

inherits(LicenseDataFollower, Readable)

var prototype = LicenseDataFollower.prototype

prototype.start = function () {
  var self = this

  var pressure = self._pressure =
  pressureStream(function (change, next) {
    self._onChange(change, function (error, data) {
      if (error) return next(error)
      self._setSequence(change.seq, next)
    })
  }, {high: 1, max: 1, low: 1})

  var changes = self._changes = changesStream({
    db: 'https://replicate.npmjs.com',
    include_docs: true,
    since: self._fromSequence
  })

  pump(changes, pressure)
  .on('error', function (error) {
    self.emit('error', error)
  })
}

prototype.stop = function () {
  this._changes.destroy()
}

prototype.sequence = function () {
  return this._sequence
}

var SEQUENCE_KEY = 'sequence'

prototype._setSequence = function (sequence, callback) {
  var self = this
  self._levelup.put(SEQUENCE_KEY, sequence, function (error) {
    if (error) callback(error)
    else {
      self._sequence = sequence
      callback()
    }
  })
}

prototype._onChange = function (change, done) {
  var self = this
  var sequence = change.seq
  var doc = change.doc
  if (!doc.name || !doc.versions) done()
  else {
    var name = doc.name
    var versions = doc.versions
    var batch = Object.keys(versions)
    .map(function (semver) {
      var key = encodeKey(name, semver)
      var value = pick(versions[semver], ['license', 'licenses'])
      return {
        type: 'put',
        key: key,
        value: JSON.stringify(value)
      }
    })
    self._levelup.batch(batch, function (error) {
      if (error) done(error)
      else self._setSequence(sequence, done)
    })
  }
}

function encodeKey (/* variadic */) {
  return Array.prototype.slice.call(arguments)
  .map(encodeURIComponent)
  .join('/')
}

function validSequence (argument) {
  return Number.isInteger(argument) && argument > 0
}
