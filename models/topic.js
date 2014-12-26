var Topic = require('./_db').Topic;
var User = require('./_db').User;

exports.saveShyData = function (data, callback) {
  User.findOne({ login_name: 'sk' }, function (err, user) {
    if (err) {
      return callback(err);
    }
    //若没有USER
    if (!user) {
      var temp = new exports.User();
      temp.nick_name = 'sk';
      temp.login_name = 'sk';
      temp.password = 'password';
      temp.email = 'email';
      temp.access_token = require('node-uuid').v4();
      temp.save(function (err, user) {
        if (err) {
          return callback(err);
        }
        sendDataToDb(user._id);
      });
    } else {
      sendDataToDb(user._id);
    }
  });

  var sendDataToDb = function (authorId) {
    var dataLength = data.length;
    for (var i = 0; i < dataLength; i++) {
      data[i].author_id = authorId;
    };
    Topic.create(data, function (err) {
      if (err) {
        callback(err);
      } else {
        callback(null, "db save " + dataLength + " documents success!")
      }
    });
  };
};