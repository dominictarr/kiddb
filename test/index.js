
var tape = require('tape')
var Kid = require('../')
var osenv = require('osenv')
var path = require('path')
var rimraf = require('rimraf')

var tmpdir = osenv.tmpdir()

tape('simple', function (t) {
  var dirname = path.join(tmpdir, 'test-kiddb')
  rimraf(dirname, function () {
    console.log(dirname)
    var kid = Kid(dirname)
    kid.open(function (err) {
      if(err) throw err
      kid.put('foo', 'bar', function (err) {
        if(err) throw err
        kid.get('foo', function (err, value) {
          if(err) throw err
          t.equal(value, 'bar')
          //t.end()
          kid.close(function (err) {
            if(err) throw err
            var kid2 = Kid(dirname)
            kid2.open(function (err) {
              kid2.get('foo', function (err, value) {
                t.equal(value, 'bar')
                t.end()
              })
            })
          })
        })
      })
    })
  })
})

tape('multi write', function (t) {

  var dirname = path.join(tmpdir, 'test-kiddb2')
  rimraf(dirname, function () {
    var kid = Kid(dirname)
    kid.open(function (err) {
      var n = 3
      kid.put('foo', 'FOO', next)
      kid.put('bar', 'BAR', next)
      kid.put('baz', 'BAZ', next)
      function next (err) {
        if(err) throw err
        if(--n) return
        kid.get('foo', function (err, value) {
          if(err) throw err
          t.equal(value, 'FOO')
          kid.get('bar', function (err, value) {
            if(err) throw err
            t.equal(value, 'BAR')
            kid.get('baz', function (err, value) {
              if(err) throw err
              t.equal(value, 'BAZ')
              t.end()
            })
          })
        })
      }
    })
  })

})
