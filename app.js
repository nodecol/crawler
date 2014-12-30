var debug = require('debug')('crawler-app')
  , async = require('async');

var douban_shy = require('./controllers/douban-shy')
  , qiushi_month = require('./controllers/qiushi-month');

async.auto({
  doubanShy: function (callback) {
    douban_shy.crwalerShyData(function (err, data) {
      if (err) {
        callback(err);
      } else {
        callback(null, data);
      }
    });
  },
  qiushiMonth: function (callback) {
    qiushi_month.crwalerMonthData(function (err, data) {
      if (err) {
        callback(err);
      } else {
        callback(null, data);
      }
    });
  }
}, function (err, results) {
  if (err) {
    debug(err);
  } else {
    debug('success!');
  }
  debug('Bye ^_^ ');
  process.exit(0);
});