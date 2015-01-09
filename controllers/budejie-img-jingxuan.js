var debug = require('debug')('crawler-budejie-img-jingxuan')
  , superagent = require('superagent')
  , cheerio = require('cheerio')
  , async = require('async')
  , imageinfo = require('imageinfo')
  , _ = require('lodash');

var topic = require('../models/topic');

// 抓取的第一页地址
var fetch_first_page_url = 'http://www.budejie.com/';
// 抓取的列表页最大数
var fetch_max_page = 10;
// 抓取时所使用的header
var header = {};

/**
 * 根据地址抓去页面源代码
 * Callback:
 * - err, request-err
 * - data, htmlsrc
 * @param {String} url 页面地址
 * @param {Function} callback 回调函数
 */
var fetchPageSourceByUrl = function (url, callback) {
  superagent.get(url).set(header).end(function (err, sres) {
    if (err) {
      callback(err);
    } else {
      callback(null, sres.text);
    }
  });
};

exports.crwalerBudejieData = function (crwalerCallback) {
  //通过async.auto控制层层抓取所需数据
  async.auto({
    // 抓取TOPIC列表
    get_budejie_content: function (callback) {
      var page_max = fetch_max_page;
      var page_cur = 0;
      var topic_list = [];

      var getContentByBudejieListPage = function (pageUrl, cb) {
        page_cur ++;
        debug('current page url is ' + pageUrl);
        fetchPageSourceByUrl(pageUrl, function (err, data) {
          if (err) { // 抓取某页出错
            //debug('fetchPageSourceByUrl', err, err.stack);
            return cb(err);
          } else { // 抓取某页成功
            var $ = cheerio.load(data);
            // 获取该页的所有topic
            async.each($('.web_left'), function (element, cbb) {
              var imgs = []; //该页的img标签列表, 处理后的
              var img_ol_list = $(element).find('.web_conter img');
              // 获取image的宽高后再加入到topicdata中
              async.each(img_ol_list, function (element, cb1) {
                //获取每张图片的宽高数据，并相应的写入标签属性中
                var imgurl = $(element).attr("src");
                superagent.get(imgurl).set(header).end(function (err, sres) {
                  if (err) {
                    cb1(err);
                  } else {
                    var body = sres.body;
                    var imginfo = {};
                    imginfo.width = imageinfo(body).width;
                    imginfo.height = imageinfo(body).height;
                    imginfo.url = imgurl;
                    imgs.push(imginfo);
                    cb1();
                  }
                });
              }, function (err) {
                if (err) { //获取image的宽高失败
                  cbb(err);
                } else { //获取image的宽高成功
                  var topicdata = {};
                  topicdata['quote_url'] = 'http://www.budejie.com' + $(element).find('.comment_button').attr('href');
                  topicdata['quote_author'] = $(element).find('.user_name').text().trim();
                  topicdata['quote_author_url'] = '';
                  topicdata['title'] = $(element).find('.web_size').html().trim().slice(0, 200);           
                  topicdata['tags'] = [{ 'tag': 'budejie', 'name': '百思不得姐' }];
                  topicdata['create_time'] = $(element).find('.time').html().trim().slice(24); 
                  topicdata['content'] = $(element).find('.web_size').html().trim();
                  topicdata['imgs'] = imgs;
                  topic_list.push(topicdata);
                  cbb(null);
                }
              }); // end async.each
            }, function (err) {
              // 抓取该页数据完成
              if (err) {
                return cb(err);
              } else {
                // 若有下一页
                var nextUrl = $('.budejie_ye a:nth-last-child(2)').attr('href');
                if (page_cur < page_max && nextUrl) {
                  // 延时处理，避免被屏蔽
                  setTimeout(function () {
                    // 抓取下一页 递归抓其他页
                    getContentByBudejieListPage('http://www.budejie.com' + nextUrl, function (err, data) {
                      if (err) {
                        cb(err);
                      } else {
                        cb(null);
                      }
                    });
                  }, 1000); // 每列表页加载间隔1秒
                } else {
                  // 返回结果
                  cb(null);
                }
              }
            }); // end async.each
          }
        }); // end fetchPageSourceByUrl
      };
      // 开始抓取，从第一页开始
      getContentByBudejieListPage(fetch_first_page_url, function (err) {
        if (err) {
          return callback(err);
        } else {
          callback(null, topic_list);
        }
      });
    }
  // end async.auto
  }, function (err, results) {
    if (err) {
      //debug(err, err.stack);
      crwalerCallback(err);
    } else {
      //抓取到的数据保存到数据库中
      debug('budejie content length is ' + results.get_budejie_content.length);
      topic.saveShyData(results.get_budejie_content, function (err, data) {
        if (err) {
          crwalerCallback(err);
        } else {
          crwalerCallback(null, data);
        }
      });
    }
  });
}

if (require.main === module) {
  exports.crwalerBudejieData(function (err, data) {
    if (err) {
      debug(err);
    } else {
      debug(data);
    }
  });
}