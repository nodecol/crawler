var debug = require('debug')('qiushi-imgrank')
  , superagent = require('superagent')
  , cheerio = require('cheerio')
  , async = require('async')
  , imageinfo = require('imageinfo')
  , _ = require('lodash');

var topic = require('../models/topic');

// 抓取的列表页最大数
var fetch_max_page = 1;

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

exports.crwalerImgrankData = function (crwalerCallback) {
  //通过async.auto控制层层抓取所需数据
  async.auto({
    // 抓取TOPIC列表
    get_article_url_list: function (callback) {
      var page_max = fetch_max_page;
      var page_cur = 0;
      var getUrlByArticleListPageUrl = function (pageUrl, cb) {
        page_cur ++;
        debug('current list page url is ' + pageUrl);
        fetchPageSourceByUrl(pageUrl, function (err, data) {
          if (err) { // 抓取某页出错
            //debug('fetchPageSourceByUrl', err, err.stack);
            return cb(err);
          } else { // 抓取某页成功
            var url_list = [];
            var $ = cheerio.load(data);
            $('.comments').each(function (index, element) {
              var url = $(element).children('a').attr('href');
              url_list.push('http://www.qiushibaike.com' + url);
            });

            // 若还存在下一页
            var nextUrl = $('.next').attr('href');
            if (page_cur < page_max && nextUrl) {
              // 延时处理，避免被屏蔽
              setTimeout(function () {
                // 抓取下一页 递归抓其他页
                getUrlByArticleListPageUrl(nextUrl, function (err, data) {
                  if (err) {
                    return cb(err);
                  } else {
                    //合并结果
                    cb(null, url_list.concat(data));
                  }
                });
              }, 1000); // 每列表页加载间隔1秒
            } else {
              // 返回结果
              cb(null, url_list);
            }
          }
        }); // end fetchPageSourceByUrl
      };
      // 开始抓取，从第一页开始
      getUrlByArticleListPageUrl('http://www.qiushibaike.com/imgrank', function (err, data) {
        if (err) {
          return callback(err);
        } else {
          callback(null, data);
        }
      });
    },
    // 根据TOPIC列表，抓取TOPIC具体内容
    get_article_content: ['get_article_url_list', function (callback, results) {
      var url_list = results.get_article_url_list;
      var getImageWithTopicPage = function (url, cb) {
        debug('current article page url is ' + url);
        fetchPageSourceByUrl(url, function (err, data) {
          if (err) {
            cb(err);
          } else {
            var topicdata = {};
            var imgs = []; //该页的img标签列表, 处理后的
            var $ = cheerio.load(data);

            var img_ol_list = $(".thumb img");
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
                cb(err);
              } else { //获取image的宽高成功
                topicdata['quote_url'] = url;
                topicdata['quote_author'] = $('.article .author a:nth-child(2)').text().trim();
                topicdata['quote_author_url'] = 'http://www.qiushibaike.com' + $('.article .author a:nth-child(2)').attr('href');
                topicdata['title'] = $('title').html().trim();              
                topicdata['tags'] = [{ 'tag': 'qiushi', 'name': '糗事百科' }];
                topicdata['create_time'] = $('.content').attr('title');
                topicdata['content'] = $('.article .content') + $('.article .thumb');
                topicdata['imgs'] = imgs;
                //延时callback
                setTimeout(function () {
                  cb(null, topicdata);
                }, 500); // 每topic详情页的加载间隔
              }
            }); // end async.each
          }
        });
      };
      async.mapLimit(url_list, 1, function (url, cb) { // 通过mapLimit控制最大并发
        getImageWithTopicPage(url, cb);
      }, function (err, result) {
        if (err) {
          callback(err);
        } else {
          callback(null, result);
        }
      }); // end async.mapLimit
    }]
  // end async.auto
  }, function (err, results) {
    if (err) {
      //debug(err, err.stack);
      crwalerCallback(err);
    } else {
      //抓取到的数据保存到数据库中
      debug('articles article is ' + results.get_article_content.length);
      topic.saveShyData(results.get_article_content, function (err, data) {
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
  exports.crwalerImgrankData(function (err, data) {
    if (err) {
      debug(err);
    } else {
      debug(data);
    }
  });
}