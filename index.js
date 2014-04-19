
var fs = require('fs')
var path = require('path')

function readJSON (file, cb) {
  fs.readFile(file, 'utf8', function (err, data) {
    if(err) return cb(err)
    try {
      data = JSON.parse(data)
    } catch (err) {
      return cb(err)
    }
    return cb(null, data)
  })
}

function isENOENT (err) {
  return err && err.code === 'ENOENT'
}

function copy (obj) {
  var _obj = {}
  for(var k in obj)
    _obj[k] = obj[k]
  return _obj
}

module.exports = function (filename, opts) {
  opts = opts || {}
  var db, data, _data
  var _filename = filename + '~'

  var qcb = []
  var writing = false
  var onWrote = null
  return db = {

    data: null,
    _data: null,
    __data: null,

    open: function (opts, cb) {
      if(!cb) cb = opts, opts = {}
      readJSON(filename, function (err, data) {
        if(isENOENT(err)) {
          db.data = {}
          return cb(null, db)
        }
        if(err) return cb(err)
        db.data = data || {}
        cb(null, db)
      })
    },

    //the classic way to do a atomic fs writes.
    //write to a tmp file, and then mv to desired name (which is atomic)
    //if there is power loss before mv succeeds, then you still have the old data!
    // there is only one file, so there cannot be concurrent writes, throw
    // if they try to write concurrently.

    update: function (_data, cb) {
      if(!db.data) return cb(new Error('kiddb not open'))
      if(writing) throw new Error('currently writing!')
      writing = true
      db._data = _data
      console.log('writing', _data)
      fs.writeFile(_filename, JSON.stringify(_data, null, 2)+'\n', function (err) {
        if(err) return cb(err)
        fs.rename(_filename, filename, function (err) {
          db.data = _data
          db._data = null
          writing = false
          if(onWrote) onWrote()
          cb(err)
        })
      })
    },

    //instead of doing a concurrent write, queue the new writes.
    //these can probably be merged together, and then a bunch will succeed at once.
    //if you contrived your benchmark the right way, this could look like really great performance!

    queueUpdate: function (_data, cb) {
      if(!db.data) return cb(new Error('kiddb not open'))
      db.__data = _data
      qcb.push(cb)
      onWrote = function () {
        onWrote = null
        var cbs = qcb; qcb = []
        var _data = db.__data
        db.__data = null
        db.update(_data, function (err) {
          cbs.forEach(function (cb) {
            cb(err)
          })
        })
      }
    },

    //following is a bunch of stuff to make give the leveldown api...

    get: function (key, cb) {
      if(!db.data) return cb(new Error('kiddb not open'))
      if(db.data[key]) cb(null, db.data[key])
      else          cb(new Error('not found'))
    },

    put: function (key, value, opts, cb) {
      if(!cb) cb = opts, opts = {}
      if(!db.data) return cb(new Error('kiddb not open'))
      db.batch([{key: key, value: value, type: 'put', options: opts}], cb)
    },

    del: function (key, opts, cb) {
      if(!db.data) return cb(new Error('kiddb not open'))
      if(!cb) cb = opts, opts = {}
      db.batch([{key: key, value: value, type: 'put', options: opts}], cb)
    },

    batch: function (batch, opts, cb) {
      if(!cb) cb = opts, opts = {}
      if(!db.data) return cb(new Error('kiddb not open'))
      var obj = copy(db.__data || db.data)
      batch.forEach(function (op) {
        if(op.type == 'put')
          obj[op.key] = op.value
        else
          delete obj[op.key]
      })
      if(!writing) db.update(obj, cb)
      else         db.queueUpdate(obj, cb)
    },

    close: function (cb) {
      function close () {
        db.data = db._data = db.__data = null
        cb()
      }
      if(writing) qcb.push(close)
      else        close()
    }
  }
}
