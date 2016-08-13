var Transform = require('readable-stream').Transform
var inherits = require('util').inherits

module.exports = RegistryLicenseFollower

function RegistryLicenseFollower () {
  if (!(this instanceof RegistryLicenseFollower)) {
    return new RegistryLicenseFollower()
  }
  Transform.call(this, {
    writableObjectMode: true,
    readableObjectMode: true
  })
}

inherits(RegistryLicenseFollower, Transform)

var prototype = RegistryLicenseFollower.prototype

prototype._transform = function (change, _, callback) {
  var sequence = change.seq
  var doc = change.doc
  var stream = this
  if (doc && doc.name && doc.versions) {
    var name = doc.name
    var versions = doc.versions
    Object.keys(versions).forEach(function (version) {
      var release = versions[version]
      var hasLicense = release.hasOwnProperty('license')
      var object = {
        sequence: sequence,
        name: name,
        version: version,
        hasLicense: hasLicense
      }
      if (hasLicense) {
        object.license = versions[version].license
      }
      stream.push(object)
    })
  }
  callback()
}
