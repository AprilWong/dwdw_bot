'use strict'

/**
 * Global error handler
 */
process.on('uncaughtException', e => console.log(e.stack));

var fs = require('fs')
var request = require('request');
var parseString = require('xml2js').parseString;
var config = require('./config.json')
var tg = require('telegram-node-bot')(config.token)
var usersheet = require('./user.json')
var ppqsheet = require('./game.json')
var streamsheet = require('./stream.json')
var movie = require('./movie.js')
var lol = require('./lol.js')
var twitch = require('./twitch.js')

var twitch_notification = []

function twitchCallback(id){
	let message = ""
	streamsheet.forEach((item)=>{
		if (item.user_id == id){
			message += item.message
	//		if(!item.toggle) {
				message += "上线啦！:"
				message += item.link
	//		} else message += "洗洗睡了"
	//		item.toggle = !item.toggle
		}
	})
	twitch_notification.forEach((chatId)=>{
		tg.sendMessage(chatId, message)
	})
}

twitch.initialize(twitchCallback)

const qaq = ['⚆_⚆', '...⁄(⁄ ⁄•⁄ω⁄•⁄ ⁄)⁄....', '(๑¯ิε ¯ิ๑)', '( ͡° ͜ʖ ͡°)', '...(｡•ˇ‸ˇ•｡) ...', '٩̋(๑˃́ꇴ˂̀๑)', '눈_눈', '(ÒωÓױ)', '((*′ ▽‘)爻(′▽‘*))', '(ง •̀_•́)ง┻━┻', '(ฅ´ω`ฅ)','(๑>◡<๑)', '(❁´▽`❁)', '～♪( ´θ｀)ノ', '(੭ु≧▽≦)੭ु', '(´・ω・｀)', '╰(*°▽°*)╯', '(PД`q。)·。。。。。。','(●′ω`●)','(　･ิω･ิ)ノิ'] 

tg.router
    .when(['ping'], 'PingController')
    .when(['/start'], 'StartController')
    .when(['/movie'], 'MovieController')
    // .when(['/lol'], 'LOLController')
    .when(['/ppq'], 'PPQController')
    .when(['/cfm'], 'MealController')
    // .when(['/addwinner'], 'AddwinnerController')
    // .when(['/winner'], 'WinnerController')
    .when(['/bus'], 'BusController')
    .when(['/twitch'], 'TwitchController')
    .when(['/chat'], 'ChatController')
    .otherwise('AllController')

tg.controller('ChatController', ($) =>{
    let text = $.args
    request.get({url: "http://127.0.0.1:5000", qs: {"que": text}}, function(err, response, body) {
        if(err){
            $.sendMessage("啊呀我坏了")
        } else{
            let content = JSON.parse(body)
            $.sendMessage(content["text"])
        }
    })
})

tg.controller('TwitchController', ($) => {
	let index = twitch_notification.indexOf($.chatId)
	if (index >= 0){
		$.sendMessage("Remove Twitch notification")
		twitch_notification.splice(index, 1)
	}
	else {
		$.sendMessage("Add Twitch notification")
		twitch_notification.push($.chatId)
	}
})

tg.controller('PingController', ($) => {
    tg.for('ping', () => {
        if(isLeo($)) $.sendMessage("ping个毛线")
        else $.sendMessage('pong')
    })
})

tg.controller('BusController', ($) => {
    if (isLeo($)) $.sendMessage("坐个毛线的车")
    else {
        $.sendMessage("Next buses at SCIENCE RD")
        request('http://api.translink.ca/rttiapi/v1/stops/51862/estimates?apikey='+config.translink_token, function(error, response, body) {
            if(!error && response.statusCode == 200) {
                parseString(body, function (err, result) {
                    result.NextBuses.NextBus.forEach((bus) => {
                        $.sendMessage('The next ' + bus.RouteNo + ':  ' + bus.Schedules[0].Schedule[0].ExpectedLeaveTime)
                    })
                })
            }
        })
    }
})

tg.controller('WinnerController', ($) => {
    var playerlist = []
    var ppqPlayer = getppqPlayer(usersheet)
    ppqPlayer.forEach((player)=>{
        var time = 0
        for (var i = 0; i < ppqsheet.length; i++) {
            if (ppqsheet[i].winner == player.first_name)
            time++;
        }
        player.time = time
    })
    ppqPlayer.sort(function(a, b) {
        return a.time < b.time
    })
    var str = ''
    ppqPlayer.forEach((player) =>{
        if (player.time != 0)
            str = str + player.first_name + ' - ' + player.time + '; '
    })
    $.sendMessage(str)
})

function enterWinner(name, adder, $) {
    var newrecord = new Object()
    var datetime = new Date()
    newrecord['winner'] = name
    newrecord['adder'] = adder
    newrecord['date'] = datetime.getDate()
    newrecord['month'] = datetime.getMonth() + 1
    ppqsheet.push(newrecord) 
    updateSheet('game.json', ppqsheet)
    $.sendMessage("Gotcha! " + name + " is the winner today~")
}

tg.controller('AddwinnerController', ($) => {
    var ppqPlayer = getppqPlayer(usersheet)
    var menu = {
        message: 'Who is the winner today?',
        layout: 2,
    }
    ppqPlayer.forEach((player) => {
        menu[player.first_name] = () => { enterWinner(player.first_name, $.message.from.id, $)}
    })
    $.runMenu(menu)
})

function getppqPlayer(usersheet) {
    var ppqPlayer = []
    usersheet.forEach((user) =>{
        if (user.isppq == true) ppqPlayer.push(user)
    })
    return ppqPlayer
}

function isLeo($){
    if($.message.from.username=="xxx")
        return true
    else
        return false
}

function checkUser($) {
    var is_new = true;
    usersheet.forEach((user) => {
        if (user.id == $.message.from.id)  is_new = false
    })
    if(!is_new) return;
    var newuser = new Object()
    newuser["id"] = $.message.from.id
    newuser["username"] = $.message.from.username
    newuser["first_name"] = $.message.from.first_name
    newuser["last_name"] = $.message.from.last_name
    usersheet.push(newuser)
    updateSheet('user.json', usersheet)
}

function updateSheet(name, namejson){
    fs.writeFile(name, JSON.stringify(namejson, null, 4), (err) => {
        if(err)
            console.log(err);
    })
}

function queryMovie($) {
    movie.movieInTheater().then((val) => {
        var returnMessage = '最近可以看的大于6.5分的电影有' + val.map(v => `${v.title}(${v.rating})`).join(' ')
        if (isLeo($)) $.sendMessage("看个毛线的电影")
        else $.sendMessage(returnMessage)
    })
}

function replyApril($) {
    $.sendMessage('她在为了建设社会主义而好好学习呢' + randomSomething(qaq))
}

function queryLOL($) {
    usersheet.forEach((user) => {
        if (user.id == $.message.from.id) {
            lol.getRank(user.player_name, user.server_name).then((val) => {
                if(val.tier != null) $.sendMessage('你的段位是' + val.tier + val.rank + "，要不要和dw一起上分？")
                    else $.sendMessage('噫，你还没有段位，多打打匹配再来找dw上分吧')
            })
        }
    })    
}

function queryLOLFree($) {
    lol.getFreeHero().then((val) => {
        var returnMessage = "打呀打呀，听说这周周免有"
        for(var hero in val) {
            returnMessage = returnMessage + val[hero].name + '、'
        }
        $.sendMessage(returnMessage)
    })
}

function getLOLUser() {
    usersheet.forEach((user) => {
        lol.getUserArea(user.player_name).then((val) => {
            val.data.forEach((account) => {
                if (account.area_id == user.server_id) {
                    user['qquin'] = account.qquin
                }
            })
            updateUserSheet()
        })
    })
}

function updateLOLCombat($){
    usersheet.forEach((user) => {
        lol.getCombatList(user.qquin, user.server_id).then((val) => {
            if (user.recent_game_id != val[0].game_id) {
                $.sendMessage(user.username + '又在偷偷打LOL了，结果' + val[0].result + '了，真是一把' + val[0].judgement)
                user.recent_game_id = val[0].game_id
                updateUserSheet()
            }
        })
    })
}

function randomSomething(pool){
    return pool[Math.floor(Math.random() * pool.length)]
}

tg.controller('StartController', ($) => {
    if(isLeo($)) $.sendMessage("走开，别烦我")
    else $.sendMessage('Hello, ' + $.message.from.first_name);
    checkUser($); 
})

tg.controller('MovieController', ($) => {
    checkUser($)
    queryMovie($)
    console.log('movie')
})

tg.controller('LOLController', ($) => {
    checkUser($)
    queryLOLFree($)
    console.log('lol')
})

tg.controller('PPQController', ($) => {
    checkUser($)
    var pool = ['jrc', 'leo', 'datui', 'wy', 'cjc']
    if(isLeo($)) $.sendMessage("打个毛线的球")
    else $.sendMessage(randomSomething(pool) + '去看看ppq有没有人 ')
})

tg.controller('MealController', ($) => {
    checkUser($)
    var pool = ['竹园', '牛肉面', 'Sushi', 'Brito', 'A&W', 'Waffle House', 'pizza', 'donair']
    var luckydog = Math.floor(Math.random() * pool.length)
    if(isLeo($)) $.sendMessage('吃个毛线的饭')
    else $.sendMessage('那就吃'+ randomSomething(pool) + '吧！')
})

tg.controller('NoiseController', ($) => {
    $.sendMessage('你烦不烦啊')
})

tg.controller('AllController', ($) => {
    if(typeof $.message.text != 'undefined'){
        checkUser($)
        // updateLOLCombat($)
        // if($.message.text.match(/kdy|电影|今晚有没有/) != null) queryMovie($)
        // if($.message.text.match(/dyx|游戏|今晚有没有/) != null) queryLOLFree($)
        // if($.message.text.match(/april|April|大王|王奕|学姐|wy/)!= null) replyApril($)
    }
})

