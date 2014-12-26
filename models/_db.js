var mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1/testnode', function (err) {
  if (err) {
    console.error('connect to %s error: ', 'mongodb://127.0.0.1/testnode', err.message);
    process.exit(1);
  }
});
var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;

//user
var UserSchema = new Schema({
  nick_name: { type: String},
  login_name: { type: String},
  email: { type: String},
  password: { type: String },
  access_token: {type: String},
  create_time: { type: Date, default: Date.now }
});
UserSchema.index({login_name: 1}, {unique: true});
mongoose.model('User', UserSchema);

//topic
var TopicSchema = new Schema({
  title: { type: String },
  imgs: { type: [String] },
  content: { type: String },
  tags: {type: [{}]},
  author_id: { type: ObjectId },
  is_html: { type: Boolean, default: true },
  quote_url: { type: String}, // 引用地址
  quote_author: { type: String }, // 引用作者（原作者）
  quote_author_url: { type: String }, // 引用作者主页地址
  update_time: { type: Date, default: Date.now },
  create_time: { type: Date, default: Date.now }
});
TopicSchema.index({create_time: -1});
TopicSchema.index({author_id: 1, create_time: -1});
mongoose.model('Topic', TopicSchema);

//reply
var ReplySchema = new Schema({
  content: { type: String },
  topic_id: { type: ObjectId},
  author_id: { type: ObjectId },
  reply_id: { type: ObjectId }, // 回复的回复id
  is_html: { type: Boolean },
  update_time: { type: Date, default: Date.now },
  create_time: { type: Date, default: Date.now }
});
ReplySchema.index({topic_id: 1});
ReplySchema.index({author_id: 1, create_time: -1});
mongoose.model('Reply', ReplySchema);

//exports
exports.User = mongoose.model('User');
exports.Topic = mongoose.model('Topic');
exports.Reply = mongoose.model('Reply');