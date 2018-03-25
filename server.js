var express  = require('express'),
    path     = require('path'),
    bodyParser = require('body-parser'),
    app = express(),
    expressValidator = require('express-validator');


/*Set EJS template Engine*/
app.set('views','./views');
app.set('view engine','ejs');

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true })); //support x-www-form-urlencoded
app.use(bodyParser.json());
app.use(expressValidator());

/*MySql connection*/
var connection  = require('express-myconnection'),
    mysql = require('mysql');
    var mongoose = require('mongoose');
    var Web3 = require('web3');
    var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

    web3.eth.syncing;
    //web3.eth.isSyncing().then(console.log);
    
app.use(
    connection(mysql,{
        host     : 'localhost',
        user     : 'root',
        password : '$cryptodb#',
        database : 'cryptodb',
        debug    : false //set true if you wanna see debug logger
    },'request')
);

/*mongoose.connect('mongodb://localhost/cryptodev',function(err,res){
  if(err){console.log('ERROR: connecting to Database. ' + err);}*/
  app.listen(3001, function(){
    console.log("Node server running on http://localhost:3001");
  });
//});

app.get('/',function(req,res){
    res.send('Welcome to API ether by Cryptodev');
});


//RESTful route
var router = express.Router();


/*------------------------------------------------------
*  This is router middleware,invoked everytime
*  we hit url /api and anything after /api
*  like /api/user , /api/user/7
*  we can use this for doing validation,authetication
*  for every route started with /api
--------------------------------------------------------*/
router.use(function(req, res, next) {
    console.log(req.method, req.url);
    next();
});

var balancep = router.route('/balance/:token');

balancep.get(function(req,res,next){
    var label = req.params.label;
    var token = req.params.token;

    req.getConnection(function(err,conn){
        if(err) 
            return next("Cannot Connect");

        conn.query("SELECT * FROM ether_wallet WHERE token = '"+token+"'",function(err,rows){
            if(err){console.log(err);return next("Mysql error, check your query");}
            if(rows.length > 0)
            {
                var address = rows[0].address;
                var correo = rows[0].correo;
                if(web3.utils.isAddress(address))
                {
                    web3.eth.getBalance(address).then(function(response){
                        conn.query("UPDATE ether_wallet SET saldo_eth = '"+web3.utils.fromWei(response,"ether")+"' WHERE address = '"+address+"'",function(err,rows){
                            if(err){console.log(err);return next("Mysql error, check your query");}
                        });
                        ethereum_market(function(price){
                            var saldo = parseFloat(web3.utils.fromWei(response,"ether")) * parseFloat(price);
                            sql_reconect("UPDATE ether_wallet SET saldo_usd = '"+saldo.toFixed(2)+"' WHERE correo = '"+correo+"'",function(response){
                                console.log(response);
                            });
                        });
                        res.status(200).json(web3.utils.fromWei(response,"ether"));
                    });
                }
            }
            else
                res.status(400).json("error");
        });
    });
});

var addaccount = router.route('/addaccount/:token/:label');

addaccount.get(function(req,res,next){
    var label = req.params.label;
    var token = req.params.token;
    req.getConnection(function(err,conn){
        if(err) 
            return next("Cannot Connect");

         conn.query("SELECT * FROM ether_wallet WHERE token = '"+token+"'",function(err,rows){
            if(err){console.log(err);return next("Mysql error, check your query");}
            
            if(rows.length > 0)
            {
                var account = web3.eth.accounts.create(label);
                var query = conn.query("INSERT INTO ether_account VALUES (null,'"+account.address+"','"+account.privateKey+"','"+token+"',0,'"+label+"')",function(err,rows){
                    if(err){
                        console.log(err);
                        return next("Mysql error, check your query");
                    }
                });
                res.status(200).json(account);
            }
            else
                res.status(400).json("error");
        });
    });
});

var create = router.route('/create/:token/:correo/:password/:label');

create.get(function(req,res,next){
    var label = req.params.label;
    var token = req.params.token;
    var correo = req.params.correo;
    var password = req.params.password;
    var md5 = require('md5');

    req.getConnection(function(err,conn){
        if(err) 
            return next("Cannot Connect");
        conn.query("SELECT * FROM ether_account WHERE token = '"+token+"'", function (err, rowsf) {
            if(err){console.log(err);return next("Mysql error, check your query");}
            
            if(rowsf.length > 0)
            {
                var wallet;
                var nObj;
                var consulta = conn.query("SELECT * FROM ether_wallet WHERE correo = '"+correo+"'",function(err,rows){
                       if(err){
                            console.log(err);
                            res.status(200).json("error!");
                        }
                        else if(rows.length > 0) 
                        {
                            res.status(200).json("email exits!");
                            return;
                        }
                        else
                        {
                            //wallet = web3.eth.accounts.wallet;
                            nObj = web3.eth.accounts.create(0);
                            //wallet.add(nObj);
                            var tokenew = md5(Math.floor((Math.random() * 999999) + 100000));
                            conn.query("INSERT INTO ether_wallet VALUES (null,'"+nObj.address+"','"+nObj.privateKey+"','"+correo+"','"+password+"','"+label+"','"+tokenew+"',0,0)",function(err,rows){
                                if(err){
                                    console.log(err);
                                    return next("Mysql error, check your query");
                                }
                            });
                            conn.query("SELECT address,privateKey,correo AS email,token AS apiKey, saldo_eth AS balance, label FROM ether_wallet WHERE token = '"+tokenew+"'",function(err,rows){
                                if(err){
                                    console.log(err);
                                    return next("Mysql error, check your query");
                                }
                                res.status(200).json(rows)/*preventCircularJson(wallet));*/
                            });
                        }

                    });
            }
            else
                res.status(400).json("error");
        });
    });
});

var addrbalance = router.route('/addressbalance/:token/:address');

addrbalance.get(function(req,res,next){
    var address = req.params.address;
    var token = req.params.token;
    req.getConnection(function(err,conn){
        if(err) 
            return next("Cannot Connect");
        conn.query("SELECT * FROM ether_wallet INNER JOIN ether_account ON ether_wallet.token = ether_account.token WHERE ether_account.address = '"+address+"'",function(err,rows){
            if(err){console.log(err);return next("Mysql error, check your query");}
            
            if(rows.length > 0)
            {
                if(web3.utils.isAddress(address))
                {
                    web3.eth.getBalance(address).then(function(response){
                        conn.query("UPDATE ether_account SET balance = '"+web3.utils.fromWei(response,"ether")+"' WHERE address = '"+address+"'",function(err,rows){
                            if(err){console.log(err);return next("Mysql error, check your query");}
                        });
                        res.status(200).json(response);
                    });
                }
               
            }
            else
                res.status(400).json("addres no exists in the wallet");
        });
    });
});

var transactioncount = router.route('/transactioncount/:token/:address');

transactioncount.get(function(req,res,next){
    var address = req.params.address;
    var token = req.params.token;
    req.getConnection(function(err,conn){
        if(err) 
            return next("Cannot Connect");
        if(web3.utils.isAddress(address))
        {   
            conn.query("SELECT token FROM ether_wallet WHERE token = '"+token+"'",function(err,rows){
                if(rows.length == 1)
                {
                    web3.eth.getTransactionCount(address).then(function(response){
                        res.status(200).json(response);
                    });
                }
                else
                    res.status(200).json("error!!");
            });
        }
        else
            res.status(200).json("error!!")
    });
});

var from_eth = router.route('/from_eth/:value');

from_eth.get(function(req,res,next){
    var value = req.params.value;
    req.getConnection(function(err,conn){
        if(err) 
            return next("Cannot Connect");
        ethereum_market(function(response){
            var result = parseFloat(value) * parseFloat(response);
            res.status(200).json(result.toFixed(2));
        });
    });
});

var from_usd = router.route('/from_usd/:value');

from_usd.get(function(req,res,next){
    var value = req.params.value;
    req.getConnection(function(err,conn){
        if(err) 
            return next("Cannot Connect");
        ethereum_market(function(response){
            var result = parseFloat(value) / parseFloat(response);
            res.status(200).json(result);
        });
    });
});

var getaccounts = router.route('/getaccounts');

getaccounts.get(function(req,res,next){
    req.getConnection(function(err,conn){
        if(err) 
            return next("Cannot Connect");
            web3.eth.getAccounts().then(function(response){
                res.status(200).json(response);
            });
           // res.status(200).json("error!!")
    });
});
var send = router.route('/send/:token/:de/:para/:value/:gasLimit/:gasPrice/:pin');

send.get(function(req,res,next){
    var token = req.params.token;
    var gasL = req.params.gasLimit;
    var gasP = req.params.gasPrice;
    var PIN = req.params.pin;
    var de = req.params.de;
    var para = req.params.para;
    var value = req.params.value;
    req.getConnection(function(err,conn){
        if(err) 
            return next("Cannot Connect");
        conn.query("SELECT token,password FROM ether_wallet WHERE token ='"+token+"' AND password='"+PIN+"'",function(err,rows){
            if(err){console.log(err);return next("Mysql error, check your query");}
            if(rows.length == 1)
            {
                if(web3.utils.isAddress(de) && web3.utils.isAddress(para))
                {   
                    web3.eth.personal.unlockAccount(de,'12345678').then(function(response){
                        if(gasL < 21500)res.status(200).json("the gas is very low!");
                        else if(gasP < 1)res.status(200).json("the price of gas is very low!");
                        else if(response)
                        {
                            web3.eth.sendTransaction({
                                from: de, 
                                to: para,
                                value: web3.utils.toWei(value, 'ether'),
                                gas : gasL,
                                gasPrice: web3.utils.toWei(gasP, "gwei")
                            }).on('transactionHash', function(hash){
                                res.status(200).json(hash);
                                console.log(hash);
                                var fee = gasL * web3.utils.fromWei(gasP,"gwei");
                                console.log(fee)
                                sql_reconect("INSERT INTO ether_send VALUES (null,'"+de+"','"+para+"','"+value+"','0','0','"+hash+"','"+fee+"',current_date,current_time,'Transaction inserted with CURL API')",function(response){
                                    console.log(response);
                                });
                                ethereum_market(function(price){
                                    var saldo = parseFloat(value) * parseFloat(price);
                                    sql_reconect("UPDATE ether_send SET cant_usd = '"+saldo.toFixed(2)+"', valor_eth = '"+price+"' WHERE hash = '"+hash+"'",function(response){
                                        console.log(response);
                                    });
                                });
                            })
                            .on('receipt', function(receipt){
                                console.log(receipt);
                            })
                            .on('confirmation', function(confirmationNumber, receipt){ })
                            .on('error', function(err){
                                console.log(err.message);
                                res.status(200).json(err.message);
                                return;
                            });
                        }
                    });
                }
                else
                    res.status(200).json("error!");
            }
        });
    });
});

var curut = router.route('/wallet/:token');


//show the CRUD interface | GET
curut.get(function(req,res,next){

    var token = req.params.token;
    req.getConnection(function(err,conn){

        if(err) 
            return next("Cannot Connect");

        var query = conn.query("SELECT correo AS email,address,privateKey,saldo_eth AS balance FROM ether_wallet WHERE token = '"+token+"'",function(err,rows){

            if(err){
                console.log(err);
                return next("Mysql error, check your query");
            }

            res.status(200).json(rows);

         });

    });

});
//post data to DB | POST
curut.post(function(req,res,next){

    //validation
    req.assert('name','Name is required').notEmpty();
    req.assert('email','A valid email is required').isEmail();
    req.assert('password','Enter a password 6 - 20').len(6,20);

    var errors = req.validationErrors();
    if(errors){
        res.status(422).json(errors);
        return;
    }

    //get data
    var data = {
        name:req.body.name,
        email:req.body.email,
        password:req.body.password
     };

    //inserting into mysql
    req.getConnection(function (err, conn){

        if (err) return next("Cannot Connect");

        var query = conn.query("INSERT INTO t_user set ? ",data, function(err, rows){

           if(err){
                console.log(err);
                return next("Mysql error, check your query");
           }

          res.sendStatus(200);

        });

     });

});


//now for Single route (GET,DELETE,PUT)
var curut2 = router.route('/user/:user_id');

/*------------------------------------------------------
route.all is extremely useful. you can use it to do
stuffs for specific routes. for example you need to do
a validation everytime route /api/user/:user_id it hit.

remove curut2.all() if you dont want it
------------------------------------------------------*/
curut2.all(function(req,res,next){
    console.log("You need to smth about curut2 Route ? Do it here");
    console.log(req.params);
    next();
});

//get data to update
curut2.get(function(req,res,next){

    var user_id = req.params.user_id;

    req.getConnection(function(err,conn){

        if (err) return next("Cannot Connect");

        var query = conn.query("SELECT * FROM account WHERE id = ? ",[user_id],function(err,rows){

            if(err){
                console.log(err);
                return next("Mysql error, check your query");
            }

            //if user not found
            if(rows.length < 1)
                return res.send("User Not found");

            res.render('edit',{title:"Edit user",data:rows});
        });

    });

});

//update data
curut2.put(function(req,res,next){
    var user_id = req.params.user_id;

    //validation
    req.assert('name','Name is required').notEmpty();
    req.assert('email','A valid email is required').isEmail();
    req.assert('password','Enter a password 6 - 20').len(6,20);

    var errors = req.validationErrors();
    if(errors){
        res.status(422).json(errors);
        return;
    }

    //get data
    var data = {
        name:req.body.name,
        email:req.body.email,
        password:req.body.password
     };

    //inserting into mysql
    req.getConnection(function (err, conn){

        if (err) return next("Cannot Connect");

        var query = conn.query("UPDATE t_user set ? WHERE user_id = ? ",[data,user_id], function(err, rows){

           if(err){
                console.log(err);
                return next("Mysql error, check your query");
           }

          res.sendStatus(200);

        });

     });

});

//delete data
curut2.delete(function(req,res,next){

    var user_id = req.params.user_id;

     req.getConnection(function (err, conn) {

        if (err) return next("Cannot Connect");

        var query = conn.query("DELETE FROM t_user  WHERE user_id = ? ",[user_id], function(err, rows){

             if(err){
                console.log(err);
                return next("Mysql error, check your query");
             }

             res.sendStatus(200);

        });
        //console.log(query.sql);

     });
});

//now we need to apply our router here
app.use('/api/ether', router);

//start Server
/*var server = app.listen(3001,function(){
   console.log("Listening to port %s",server.address().port);
});*/

function isWallet(token,conn,callback)
{
    conn.connect(function(err){
        if(err)return;
        conn.query("SELECT * FROM ether_account WHERE token = '"+token+"'", function (err, result, fields) {
            if(err) {console.log(err);
                        return next("Mysql error, check your query");}
            console.log(result);
            callback(true);
        });
    });
}

function preventCircularJson(source, censoredMessage, censorTheseItems) {
    //init recursive value if this is the first call
    censorTheseItems = censorTheseItems || [source];
    //default if none is specified
    censoredMessage = censoredMessage || "CIRCULAR_REFERENCE_REMOVED";
    //values that have allready apeared will be placed here:
    var recursiveItems = {};
    //initaite a censored clone to return back
    var ret = {};
    //traverse the object:
    for (var key in source) {
        var value = source[key]
        if (typeof value == "object") {
            //re-examine all complex children again later:
            recursiveItems[key] = value;
        } else {
            //simple values copied as is
            ret[key] = value;
        }
    }
    //create list of values to censor:
    var censorChildItems = [];
    for (var key in recursiveItems) {
        var value = source[key];
        //all complex child objects should not apear again in children:
        censorChildItems.push(value);
    }
    //censor all circular values
    for (var key in recursiveItems) {
        var value = source[key];
        var censored = false;
        censorTheseItems.forEach(function (item) {
            if (item === value) {
                censored = true;
            }
        });
        if (censored) {
            //change circular values to this
            value = censoredMessage;
        } else {
            //recursion:
            value = preventCircularJson(value, censoredMessage, censorChildItems.concat(censorTheseItems));
        }
        ret[key] = value

    }

    return ret;
}

function ethereum_market(callback)
{
    let curl = require('curlrequest');
    let options = {url:"https://api.coinmarketcap.com/v1/ticker/ethereum/"}
    curl.request(options,(err,response)=>{
        
        if(err){console.log(err); return;}
        
        var out = response;
        out = out.split(",");
        aux = out[4].replace('"price_usd": "',"");
        aux = aux.trim();
        aux = aux.replace('"',"");
        callback(aux);
    });
}

function sql_reconect(sql,callback)
{
    var conn_aux = mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "$cryptodb#",
        database : 'cryptodb'
    });
    conn_aux.query(sql,function(err,rows){
        if(err){callback(err);return;}
        //callback(rows);
    });
    conn_aux.end();
}