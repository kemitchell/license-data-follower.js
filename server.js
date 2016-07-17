var level = require('level')
var Follower = require('./')

var follower = new Follower(level('./test'))
follower.start()
