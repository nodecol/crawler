var debug = require('debug')('crawler-douban-shy')
  , superagent = require('superagent')
  , cheerio = require('cheerio')
  , async = require('async')
  , imageinfo = require('imageinfo')
  , _ = require('lodash');

var topic = require('../models/topic');

// 抓取时所使用的header
var header = {
  'Accept' : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Encoding' : 'gzip, deflate, sdch',
  'cookie' : 'viewed="5362856"; ct=y; ll="118172"; dbcl2="106283334:9dn78i9kCic"; ck="hQX6"; bid="qWK40sVDQR0"; __utma=30149280.639687436.1413723293.1416490957.1416496152.48; __utmc=30149280; __utmz=30149280.1416388002.43.10.utmcsr=localhost:3000|utmccn=(referral)|utmcmd=referral|utmcct=/; __utmv=30149280.10628; push_noty_num=0; push_doumail_num=1; _pk_ref.100001.8cb4=%5B%22%22%2C%22%22%2C1416501062%2C%22http%3A%2F%2Flocalhost%3A3000%2F%22%5D; _pk_id.100001.8cb4=b0abd870edd5af87.1413723289.45.1416501062.1416498619.; _pk_ses.100001.8cb4=*',
  'User-Agent' : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0.2214.6 Safari/537.36',
  'Connection' : 'keep-alive',
  'Accept-Language' : 'en-US,en;q=0.8,zh-CN;q=0.6,zh-TW;q=0.4'
}
// 抓取的列表页最大数
var fetch_max_page = 10;

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

exports.crwalerShyData = function (crwalerCallback) {
  //通过async.auto控制层层抓取所需数据
  async.auto({
    // 抓取TOPIC列表
    get_topic_url_list: function (callback) {
      var page_max = fetch_max_page;
      var page_cur = 0;
      var getUrlByTopicListPageUrl = function (pageUrl, cb) {
        page_cur ++;
        debug('current list page url is ' + pageUrl);
        fetchPageSourceByUrl(pageUrl, function (err, data) {
          if (err) { // 抓取某页出错
            //debug('fetchPageSourceByUrl', err, err.stack);
            return cb(err);
          } else { // 抓取某页成功
            var url_list = [];
            var $ = cheerio.load(data);
            $('.olt tr .title').each(function (index, element) {
              var url = $(element).children('a').attr('href');
              url_list.push(url);
            });

            // 若还存在下一页
            var nextUrl = $('.next a').attr('href');
            if (page_cur < page_max && nextUrl) {
              // 延时处理，避免被屏蔽
              setTimeout(function () {
                // 抓取下一页 递归抓其他页
                getUrlByTopicListPageUrl(nextUrl, function (err, data) {
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
      getUrlByTopicListPageUrl('http://www.douban.com/group/haixiuzu/discussion?start=0', function (err, data) {
        if (err) {
          return callback(err);
        } else {
          callback(null, data);
        }
      });
    },
    // 根据TOPIC列表，抓取TOPIC具体内容
    get_topic_content: ['get_topic_url_list', function (callback, results) {
      var url_list = results.get_topic_url_list;
      var getImageWithTopicPage = function (url, cb) {
        debug('current topic page url is ' + url);
        fetchPageSourceByUrl(url, function (err, data) {
          if (err) {
            cb(err);
          } else {
            var topicdata = {};
            var imgs = []; //该页的img标签列表, 处理后的
            var $ = cheerio.load(data);

            var img_ol_list = $(".topic-figure img");
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
                topicdata['quote_author'] = $('.topic-doc .from a').text().trim();
                topicdata['quote_author_url'] = $('.topic-doc .from a').attr('href');
                topicdata['title'] = $('h1').text().trim();              
                topicdata['tags'] = [{ 'tag': 'shy', 'name': '请不要害羞' }];
                topicdata['create_time'] = $('.topic-doc .color-green').text().trim();
                topicdata['content'] = $('#link-report').html();
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
    }],
    //将作者居住地信息保存在tags中
    get_topic_author_location: ['get_topic_content', function (callback, results) {
      var getLocationWithPeoplePage = function (obj, cb) {
        debug('current author url is ' + obj.quote_author_url);
        if (!obj.quote_author_url) {
          cb();
        } else {
          fetchPageSourceByUrl(obj.quote_author_url, function (err, data) {
            if (err) {
              cb(err);
            } else {
              var $ = cheerio.load(data);
              var location = $('li.loc').text().replace(/\n|\s|常居:/ig, '');
              if (obj.tags.indexOf(location) < 0 ) {
                obj.tags.push({ 'tag': 'location', 'name': location });
              }
              setTimeout(function () {
                cb();
              }, 500);
            }
          });
        }
      };

      async.mapLimit(results.get_topic_content, 1, function (url, cb) { // 通过mapLimit控制最大并发
        getLocationWithPeoplePage(url, cb);
      }, function (err, result) {
        if (err) {
          callback(err);
        } else {
          callback();
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
      debug('topics total is ' + results.get_topic_content.length);
      topic.saveShyData(results.get_topic_content, function (err, data) {
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
  exports.crwalerShyData(function (err, data) {
    if (err) {
      debug(err);
    } else {
      debug(data);
    }
  });
}