var debug = require('debug')('douban-shy')
  , superagent = require('superagent')
  , cheerio = require('cheerio')
  , async = require('async');

var header = {
  'Accept' : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Encoding' : 'gzip, deflate, sdch',
  'cookie' : 'viewed="5362856"; ct=y; ll="118172"; dbcl2="106283334:9dn78i9kCic"; ck="hQX6"; bid="qWK40sVDQR0"; __utma=30149280.639687436.1413723293.1416490957.1416496152.48; __utmc=30149280; __utmz=30149280.1416388002.43.10.utmcsr=localhost:3000|utmccn=(referral)|utmcmd=referral|utmcct=/; __utmv=30149280.10628; push_noty_num=0; push_doumail_num=1; _pk_ref.100001.8cb4=%5B%22%22%2C%22%22%2C1416501062%2C%22http%3A%2F%2Flocalhost%3A3000%2F%22%5D; _pk_id.100001.8cb4=b0abd870edd5af87.1413723289.45.1416501062.1416498619.; _pk_ses.100001.8cb4=*',
  'User-Agent' : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0.2214.6 Safari/537.36',
  'Connection' : 'keep-alive',
  'Accept-Language' : 'en-US,en;q=0.8,zh-CN;q=0.6,zh-TW;q=0.4'
}

/**
 * 根据地址抓去页面源代码
 * Callback:
 * - err, request-err
 * - data, htmlsrc
 * @param {String} url 页面地址
 * @param {Function} callback 回调函数
 */
var fetchPageSourceByUrl = function (url, callback) {
  superagent
  .get(url)
  .set(header)
  .end(function (err, sres) {
    if (err) {
      callback(err);
    } else {
      callback(null, sres.text);
    }
  });
};

async.auto({
  get_topic_url_list: function (callback) {
    var page_max = 1;
    var page_cur = 0;
    var getUrlByTopicListPageUrl = function (pageUrl, cb) {
      page_cur ++;
      debug('current list page url', pageUrl);
      fetchPageSourceByUrl(pageUrl, function (err, data) {
        if (err) { // 抓取某页出错
          //debug('fetchPageSourceByUrl', err, err.stack);
          cb(err);
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
                  cb(err);
                } else {
                  //合并结果
                  cb(null, url_list.concat(data));
                }
              });
            }, 1000); // 每页加载间隔1秒
          } else {
            // 返回结果
            cb(null, url_list);
          }
        }
      });
    };
    // 开始抓取，从第一页开始
    getUrlByTopicListPageUrl('http://www.douban.com/group/haixiuzu/discussion?start=0', function (err, data) {
      if (err) {
        callback(err);
      } else {
        callback(null, data);
      }
    });
  },
  get_topic_content: ['get_topic_url_list', function (callback, results) {
    var url_list = results.get_topic_url_list;
    var getImageFromTopicPage = function (url, cb) {
      fetchPageSourceByUrl(url, function (err, data) {
        if (err) {
          cb(err);
        } else {
          var imgs = [];
          var topicdata = {};
          var $ = cheerio.load(data);
          $(".topic-figure img").each(function (index, element) {
            imgs.push($(element).attr("src"));
          });
          topicdata['title'] = $('h1').text().trim();
          topicdata['imgs'] = imgs;

          setTimeout(function () {
            cb(null, topicdata);
          }, 10);
        }
      });
    };
    async.mapLimit(url_list, 1, function (url, cb) {
      getImageFromTopicPage(url, cb);
    }, function(err, result) {
      if (err) {
        callback(err);
      } else {
        console.log(result);
        callback(null, result);
      }
    });
  }],
  get_topic_author: function (callback, results) {
    callback(null, null)
  }

}, function (err, results) {

});