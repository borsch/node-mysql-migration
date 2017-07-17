const file_system = require('fs');
const md5_sum = require('md5-file');

/**
 * entry point to start migration util
 *
 * @param mysql_connection {Connection} -  to work with database
 * @param migrations_folder {string} - path to migrations folder
 */
module.exports.migrate = function(mysql_connection, migrations_folder) {
    if (!migrations_folder) {
        throw new Error('migrations folder are required');
    }

    let command = parse_execute_params();
    if (!command) {
       return;
    }

    if (command === 'migrate') {
        migrate(mysql_connection, migrations_folder);
    } else if (command === 'clean') {
        clean(mysql_connection);
    } else if (command === 'init') {
        init(mysql_connection);
    }
};

/**
 * create empty migration schema table
 *
 * @param mysql_connection {Connection} -  to work with database
 */
function init(mysql_connection) {
    "use strict";

    let query = `CREATE TABLE \`migration_schema\` (
                    \`version\` INT PRIMARY KEY,
                    \`name\` TEXT NOT NULL,
                    \`hash_sum\` VARCHAR(50) NOT NULL,
                    \`date\` DATETIME DEFAULT CURRENT_TIMESTAMP) ENGINE = InnoDB`;

    mysql_connection.query(query, function (err) {
        if (err) {
            error(err.message);

            mysql_connection.end();
        } else {
            info('created empty migration schema');

            mysql_connection.end();
        }
    });
}

/**
 * drop all tables in database
 *
 * @param mysql_connection {Connection} -  to work with database
 */
function clean(mysql_connection) {
    "use strict";

    mysql_connection.beginTransaction(function(err){
        if (err) {
            error(err.message);

            end();
        } else {
            mysql_connection.query(`SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='${mysql_connection.config.database}'`, function (err, result) {
                if (err) {
                    error(err.message);

                    end();
                } else {
                    let table_names = [];
                    result.forEach(function (row) {
                        table_names.push(row.TABLE_NAME);
                    });

                    if (table_names.length > 0) {
                        mysql_connection.query('SET FOREIGN_KEY_CHECKS = 0', function (err) {
                            if (err) {
                                mysql_connection.rollback();
                                error(err.message);

                                end();
                            } else {
                                mysql_connection.query(`DROP TABLE ${table_names.join(',')}`, function (err) {
                                    if (err) {
                                        mysql_connection.rollback();
                                        error(err.message);

                                        end();
                                    } else {
                                        mysql_connection.query('SET FOREIGN_KEY_CHECKS = 0', function (err) {
                                            if (err) {
                                                mysql_connection.rollback();
                                                error(err.message);

                                                end();
                                            } else {
                                                info('database is empty now');

                                                end();
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    } else {
                        warning('database already empty');

                        end();
                    }
                }
            });
        }
    });

    function end() {
        mysql_connection.end();
    }
}

/**
 * this function is an entry point to execute new migrations
 * if new are exists
 *
 * @param mysql_connection {Connection} -  to work with database
 * @param migrations_folder {string} - path to migrations folder
 */
function migrate(mysql_connection, migrations_folder) {
    "use strict";

    file_system.readdir(migrations_folder, (err, files) => {
        if (files) {
            if (files.length < 1) {
                warning('migration folder [' + migrations_folder + '] does not contains any migration');
            } else {
                info('found [' + files.length + '] migrations');

                let migrations = [];
                for (let i = 0; i < files.length; ++i) {
                    try {
                        let result = parse_file(files[i], migrations_folder + '/' + files[i]);
                        migrations.push(result);
                    } catch (e) {
                        error(e.message);

                        return;
                    }
                }

                precess_migrations(mysql_connection, migrations);
            }
        } else {
            error(err.message);

            mysql_connection.end();
        }
    });
}


/**
 * this function executes new migrations
 * if new are exists
 *
 * @param mysql_connection {Connection} -  to work with database
 * @param migrations {object[]} - all existed migrations data
 */
function precess_migrations(mysql_connection, migrations) {
    "use strict";

    migrations.sort(function(a, b){
        if (a.version > b.version) {
            return 1;
        }
        if (a.version < b.version) {
            return -1;
        }
        return 0;
    });

    check_old_migrations_checksum(mysql_connection, migrations, once(function(applied_result){
        if (!applied_result) {
            info('all existed migrations successfully applied to database');
        } else {
            let type = applied_result.type,
                version = applied_result.version;

            if (type) {
                if (type === 'SCRIPT_CHANGED') {
                    error('script version[' + version + '] is change since last migration');
                } else {
                    error('can not apply migration version[' + version + '] since there is en unexpected error');
                }

                mysql_connection.end();
            } else {
                info('new not applied migration is [' + version + ']');

                for (let i = 0; i < migrations.length; ++i) {
                    if (migrations[i].version === version) {
                        migrations = migrations.splice(i);

                        break;
                    }
                }

                if (migrations.length > 0) {
                    try {
                        let promise = apply_migration(mysql_connection, migrations[0], file_system.readFileSync(migrations[0].absolute_path, "utf8"))
                            .catch(function (version) {
                                console.log(version);
                            });

                        for (let i = 1; i < migrations.length; ++i) {
                            promise =
                                promise.then(function () {
                                    return apply_migration(mysql_connection, migrations[i], file_system.readFileSync(migrations[i].absolute_path, "utf8"));
                                })
                                    .catch(function (version) {
                                        console.log(version);
                                    });
                        }

                        promise
                            .then(function () {
                                info('all migrations successfully applied to database');

                                mysql_connection.end();
                            })
                            .catch(function (version) {
                                console.log(version);

                                mysql_connection.end();
                            });
                    } catch (e) {
                        console.log(e);
                    }
                }
            }
        }
    }));
}

function apply_migration(mysql_connection, migration, content) {
    "use strict";

    function rollback_end() {
        mysql_connection.rollback();
        mysql_connection.end();
    }

    return new Promise(function(global_resolve){
        new Promise(function(resolve){
            mysql_connection.beginTransaction(function(err){
                if (err) {
                    rollback_end();

                    error('can not start transaction. reason [' + err.message + ']');
                } else {
                    resolve();
                }
            });
        }).then(function(){
            new Promise(function(resolve){
                mysql_connection.query(content, function (err) {
                    if (err) {
                        rollback_end();

                        error('can not apply migration[' + migration.version + ']');
                        error('can not execute query. reason [' + err.message + ']');
                    } else {
                        resolve();
                    }
                });
            }).then(function(){
                new Promise(function(resolve){
                    let to_insert = {
                        version: migration.version,
                        hash_sum: migration.hash_sum,
                        name: migration.name
                    };

                    mysql_connection.query('INSERT INTO migration_schema SET ?', to_insert, function(err){
                        if (err) {
                            rollback_end();

                            error('can not apply migration[' + migration.version + ']');
                            error('can not execute query. reason [' + err.message + ']');
                        } else {
                            resolve();
                        }
                    });
                }).then(function(){
                    new Promise(function(resolve){
                        mysql_connection.commit(function(err) {
                            if (err) {
                                rollback_end();

                                error('can not apply migration[' + migration.version + ']');
                                error('can not commit transaction. reason [' + err.message + ']');
                            } else {
                                info('migration [' + migration.version + '][' + migration.name + '] successfully applied');

                                resolve();
                            }
                        });
                    }).then(function(){
                        global_resolve();
                    });
                });
            });
        });
    });
}

/**
 * checks all existed migrations in database if they does not changed
 *
 * @param mysql_connection {Connection} -  to work with database
 * @param migrations {object[]} - all existed migrations data
 * @param callback {function} - callback on check end. accept one parameter: not applied migration version or null if all is applied
 */
function check_old_migrations_checksum(mysql_connection, migrations, callback) {
    "use strict";

    let promise = sync_check_migration(mysql_connection, migrations[0])
        .catch(function (version) {
            callback(version);
        });

    for (let i = 1; i < migrations.length; ++i) {
        promise =
            promise.then(function () {
                return sync_check_migration(mysql_connection, migrations[i]);
            })
            .catch(function (version) {
                callback(version);
            });
    }

    promise
        .then(function () {
            callback(null);
        })
        .catch(function (version) {
            callback(version);
        });
}

/**
 * make sync promise-chain base call to database to check last applied migration
 *
 * @param mysql_connection {Connection} -  to work with database
 * @param migration {object} - migration to check
 * @return {Promise} - contains the result if {migration} is successfully applied
 */
function sync_check_migration(mysql_connection, migration) {
    "use strict";

    return new Promise(function(resolve, reject){
        let migration_inside = migration;
        mysql_connection.query('SELECT hash_sum FROM migration_schema WHERE version=' + migration_inside.version, function(err, result){
            if (err || !result || result.length < 1) {
                reject({
                    version: migration_inside.version
                });
            } else {
                let row = result[0];

                if (row.hash_sum !== migration.hash_sum) {
                    reject({
                        version: migration_inside.version,
                        type: 'SCRIPT_CHANGED'
                    });
                } else {
                    resolve();
                }
            }
        });
    });
}

/**
 * function the will be executed only for once
 *
 * @param fn - function to be executed only once
 * @param context
 * @return {Function}
 */
function once(fn, context) {
    let result;

    return function() {
        if(fn) {
            result = fn.apply(context || this, arguments);
            fn = null;
        }

        return result;
    };
}

/**
 * parse file name {version, name, hash_sum}
 *
 * @param file_name {string} - file name
 * @param full_path_to_file {string} - absolute file path
 */
function parse_file(file_name, full_path_to_file) {
    "use strict";

    let matches = /V(\d+)__([\w\_]+)\.sql/g.exec(file_name);
    if (!matches || matches.index < 0) {
        throw new Error(`file ['${file_name}'] has an invalid file name template\nSee help for more information`);
    }

    return {
        version: parseInt(matches[1]),
        name: matches[2].replace(/_/g, ' '),
        hash_sum: md5_sum.sync(full_path_to_file),
        absolute_path: full_path_to_file
    }
}

/**
 * parse execution arguments and return command name
 *
 * @return {string|null} - command name
 */
function parse_execute_params() {
    "use strict";


    let args = process.argv.splice(2);
    if (args.length < 1) {
        // required at least one params
        // otherwise print "help"

        help_message();

        return null;
    }

    let command = args[0];

    if (command === 'help') {
        help_message();

        return null;
    }

    return command;
}

/**
 * print help message
 */
function help_message() {
    "use strict";

    info('========================================================');
    info('required execution params');
    info('possible params are');
    info('[help] - print help message');
    info('[migrate] - migrate DB using new migrations if new is existed');
    info('[clean] - drop all tables in database');
    info('[init] - create an empty migration schema in DB');
    info('file name pattern is:');
    info('\t\t V(version name)__name_of_script_separated_with_lower_underline.sql');
    info('\t\t V1__init_tables.sql');
    info('\t\t V2__add_new_column.sql');
    info('for more info visit: https://github.com/borsch/node-mysql-migration/blob/master/README.md');
    info('========================================================');
}

function info(message) {
    "use strict";

    console.log('[INFO] ' + message);
}

function warning(message) {
    "use strict";

    console.warn('[WARNING] ' + message);
}

function error(message) {
    "use strict";

    console.error('[ERROR] ' + message);
}