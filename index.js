const file_system = require('fs');

const MIGRATION_SCHEMA_NAME = 'migration_schema';
const MIGRATION_SCHEMA = `CREATE TABLE \`${MIGRATION_SCHEMA_NAME}\` (
                            \`version\` INT PRIMARY KEY AUTO_INCLEMENT,
                            \`name\` VARCHAR(250) NOT NULL,
                            \`hash_sum\` VARCHAR(50) NOT NULL
                            \`date\` DATETIME DEFAULT CURRENT_TIMESTAMP
                            \`success\` TINYINT(1) default 0)`;

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
    }
};


/**
 * drop all tables in database and create migration schema new table
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
 * this function executes new migrations
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
                warning('migration folder "' + migrations_folder + '" does not contains any migration');
            } else {
                info('found ' + files.length + ' migrations');


            }
        } else {
            throw err;
        }
    });
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
    info('`help` - print help message');
    info('`migrate` - migrate DB using new migrations if new is existed');
    info('`clean` - drop all tables in database');
    info('`init` - create an empty migration schema in DB');
    info('file name pattern is:');
    info('\t\t V(version name)__name_of_script_separated_with_lower_underline.sql');
    info('\t\t V1__init_tables.sql');
    info('\t\t V2__add_new_column.sql');
    info('for more info visit: ');
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