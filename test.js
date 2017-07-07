let index = require('./index');
let mysql = require('mysql');

index.migrate(mysql.createConnection({
    host     : 'localhost',
    user     : 'root',
    password : 'root',
    database : 'social_music'
}), __dirname + '/migrations');