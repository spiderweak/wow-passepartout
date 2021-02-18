// --------------------
// Discord requirements
// --------------------

const Discord = require('discord.js');
const client = new Discord.Client();
const config = require('./config.json');
const Database = require('better-sqlite3')

// --------------------
// Documentation
// --------------------

const main_arg = require('./main_arg.json');
const pp_arg = require('./pp_arg.json');

// --------------------
// Backup of current list and archives
// --------------------

const key_list = new Database('keys.db', { verbose:console.log})
const old_keys = new Database('old_keys.db', { verbose:console.log})

// --------------------
// Discord Client Handling
// --------------------

client.on('ready', () => {

  // Check if the table "points" exists.
  const table = key_list.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = 'list';").get();
  if (!table['count(*)']) {
    // If the table isn't there, create it and setup the database correctly.
    key_list.prepare("CREATE TABLE list (username TEXT PRIMARY KEY, dungeon TEXT, keyvalue INTEGER);").run();
    // Ensure that the "id" row is always unique and indexed.
    //key_list.prepare("CREATE UNIQUE INDEX idx_names_id ON list (name);").run();
    key_list.pragma("synchronous = 1");
  }

  const table = old_keys.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = 'list';").get();
  if (!table['count(*)']) {
    // If the table isn't there, create it and setup the database correctly. 
    old_keys.prepare("CREATE TABLE list (name TEXT PRIMARY KEY, dungeon TEXT, keyvalue INTEGER);").run();
    // Ensure that the "id" row is always unique and indexed. 
    //old_keys.prepare("CREATE UNIQUE INDEX idx_names_id ON list (name);").run();
    old_keys.pragma("synchronous = 1");
  }

  console.log(`Bot has started, with ${client.users.size} users, in ${client.channels.size} channels of ${client.guilds.size} guilds.`); 
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("guildCreate", guild => {
  // This event triggers when the bot joins a guild.
  console.log(`New guild joined: ${guild.name} (id: ${guild.id}). This guild has ${guild.memberCount} members!`);
});

client.on("guildDelete", guild => {
  // this event triggers when the bot is removed from a guild.
  console.log(`I have been removed from: ${guild.name} (id: ${guild.id})`);
});

client.on('message', (receivedMsg) => {
  if (receivedMsg.author.bot) return; // No response if sent by bot

  //let role = 590540221716627466

  if (!(receivedMsg.member.roles.find(r => r.name === config.role))) return;

  const logs = receivedMsg.guild.channels.find(channel => channel.name === config.channel);
  if (!logs) console.log('The interaction channel does not exist and cannot be created');

  if (receivedMsg.content.indexOf(config.prefix) === 0) processCmd(receivedMsg, logs) // Process if starts with configured prefix

//  console.log(receivedMsg.mentions.members.first())

//  if (receivedMsg.mentions.members.users === 2 && )
//    return message.reply("Please mention a user to kick");
});


// --------------------
// Functions
// --------------------

function processCmd(receivedMsg, logChan){
  let fullCmd = receivedMsg.content.substr(config.prefix.length +1) // Removes "!"
  let splitCmd = fullCmd.split(" ") // Split using spaces
  let args = splitCmd.slice(0) // Store all arguments

  console.log("Arguments : " + args)

  if (args[0] === "help" || args[0] === "h") {
    helpCmd(args, receivedMsg, logChan)
  } else {
    keyHolderCmd(args, receivedMsg, logChan)
  }
}

function helpCmd(args, receivedMsg, logChan) {
  if (args.length > 0) {
    if (args[0] === "help" || args[0] === "h") {
      helpCmd(args.slice(1), receivedMsg, logChan)
    } else {
      let handled_command_array = []
      for (let index=0; index < main_arg['command'].length; index++) {
        handled_command_array.push(main_arg['command'][index]['name'])
        Array.prototype.push.apply(handled_command_array, main_arg['command'][index]['shortcut']);      
      }
      if (handled_command_array.includes(args[0])) {
        if (args[0] === "dgm") {
          logChan.send("I can help you with that, here is how " + args[0] + " works :")
          for (let index=0; index < pp_arg['command'].length; index++) {
            logChan.send("" + (pp_arg['command'][index]['name']) + " : " + (pp_arg['command'][index]['desc']))
          }
        }
      } else {
        logChan.send("I do not provide help for this function, seems I don't know how to use it either")
      }
    }
  } else {
    logChan.send("Here is the list of commands I can handle")
    for (let index=0; index < main_arg['command'].length; index++) {
      logChan.send("" + (main_arg['command'][index]['name']) + " : " + (main_arg['command'][index]['desc']))
    }
  }
}

function keyHolderCmd(args, receivedMsg, logChan) {
  if (args.length > 0) {
    switch (args[0]) {
      case "list":
      case "ls":
          logChan.send(JSON.stringify(dumpDB(key_list)))
        break;
      case "add":
      case "a":
        if (args.length === 4) {
		const WoW_user = args[1]
		const WoW_dungeon = args[2]
		const WoW_keyvalue = (!(isNaN(parseInt(args[3])))) ? parseInt(args[3]) : 2
		insertInDB({'username':WoW_user, 'dungeon':WoW_dungeon, 'keyvalue':WoW_keyvalue},key_list)
		logChan.send("Added " + WoW_dungeon + " " + WoW_keyvalue + " for User :  " + WoW_user)

	} else if (args.length === 3) {
		const WoW_user = receivedMsg.author.username
		const WoW_dungeon = args[1]
                const WoW_keyvalue = (!(isNaN(parseInt(args[2])))) ? parseInt(args[2]) : 2
		insertInDB({'username':WoW_user, 'dungeon':WoW_dungeon, 'keyvalue':WoW_keyvalue},key_list)
                logChan.send("Added " + WoW_dungeon + " " + WoW_keyvalue + " for User :  " + WoW_user)
	} else {
          logChan.send("No keys to add")
        }
        break;
      case "ok":
        if (args.length > 1) {
          if (existsInDB(args[1], key_list)) {
            quantity = (args.length > 2 && !(isNaN(parseInt(args[2])))) ? parseInt(args[2]) : getQuantityInDB(args[1], key_list)
            insertInDB({'name':args[1], 'quantity':quantity}, old_keys)
            removeFromDB({'name':args[1], 'quantity':quantity}, key_list)
            logChan.send("Moved " + quantity + " of " + args[1] + " from the grocery list")
          } else {
            quantity = (args.length > 2 && !(isNaN(parseInt(args[2])))) ? parseInt(args[2]) : 1
            insertInDB({'name':args[1], 'quantity':quantity}, old_keys)
            logChan.send("Moved " + quantity + " of " + args[1] + " from the grocery list")
          }
        } else {
          logChan.send("Nothing to move to the OK list")
        }        
        break;
      case "nok":
        if (args.length > 1) {
          quantity = (args.length > 2 && !(isNaN(parseInt(args[2])))) ? parseInt(args[2]) : getQuantityInDB(args[1], old_keys)
          insertInDB({'name':args[1], 'quantity':quantity}, key_list)
          removeFromDB({'name':args[1], 'quantity':quantity}, old_keys)
          logChan.send("Moved " + quantity + " of " + args[1] + " from the OK list to the grocery List")
        } else {
          logChan.send("Nothing to move from the OK list")
        } 
        break;
      case "all_ok":
//        for (var index=0; index < countLinesInDB(key_list); index++) {
//          handleGroceriesCmd(["ok",, receivedMsg, logChan)
//        }
        break;
      case "delete":
      case "del":
      case "d":
      case "rm":
        if (args.length > 1) {
          quantity = (args.length > 2 && !(isNaN(parseInt(args[2])))) ? parseInt(args[2]) : getQuantityInDB(args[1], key_list)
          removeFromDB({'name':args[1], 'quantity':quantity}, key_list)
          logChan.send("Removed " + quantity + " of " + args[1] + " from the grocery list")
        } else {
          logChan.send("Nothing to add to the grocery list")
        }
        break;
      case "pay":
         backupDB(old_keys) 
         logChan.send("Thanks for doing the groceries, don't forget to add the amount paid on Splitwise")
         flushDB(old_keys)
        break;
      case "flush":
        if (args.length > 1) {
          if (args[1] === "ok" || args[1] === "Ok" || args[1] === "OK") flushDB(old_keys)
        } else {
          flushDB(key_list)
        }
        break;
      case "h":
        helpCmd(["dgm"], receivedMsg, logChan)
        break;
      default:
	logChan.send("I didn't understand. Try " + config.prefix + " `help`");
    }
  } else {
    logChan.send("Placeholder")
//    helpCmd(["dgm"], receivedMsg, logChan)
  }
}


// --------------------
// Database Specific Fct
// --------------------

function existsInDB(name_to_test, db) {
  const selectStatement = db.prepare('SELECT keyvalue FROM list WHERE username = ?');
  const quantity = selectStatement.get(name_to_test)
  if (quantity === undefined) return false
  return true
}

function getQuantityInDB(name_to_test, db) {
  const selectStatement = db.prepare('SELECT keyvalue FROM list WHERE username = ?');
  const quantity = selectStatement.get(name_to_test)
  if (quantity === undefined) return 0
  return quantity['quantity']
}

function insertInDB(item, db) {
  if (existsInDB(item['username'], db)) {
  updateInDB(item, db)
  } else {
  const insertStatement = db.prepare('INSERT INTO list (username, dungeon, keyvalue) VALUES (@username, @dungeon, @keyvalue)');
  console.log(item)
  insertStatement.run(item)
  }
}

function insertManyInDB(list, db) {
  const insertStatement = db.prepare('INSERT INTO list (username, dungeon, keyvalue) VALUES (@username, @dungeon, @keyvalue)');
  
  const insertMany = db.transaction((list) => {
    for (const item of list) insertStatement.run(item);
  });
}

function updateInDB(item, db) {
  const selectStatement = db.prepare('SELECT keyvalue FROM list WHERE username = ?');
  const quantity = selectStatement.get(item['username'])
  if (quantity === undefined) {
    console.log("Item does not exist, Inserting instead")
    insertInDB(item,db)
  } else {
    const updateStatement = db.prepare('UPDATE list SET keyvalue = ? AND dungeon = ? WHERE username = ?');
    updateStatement.run(item['keyvalue'],item['dungeon'], item['name'])
  }
}

function removeFromDB(item, db) {
	const deleteStatement = db.prepare('DELETE FROM list WHERE username = ?');
	deleteStatement.run(name_to_delete)
}

function dumpDB(db){
  return db.prepare('SELECT username, dungeon, keyvalue FROM list').all()
}

function flushDB(db){
  return db.prepare('DELETE FROM list').run()
}

function backupDB(db){
  db.backup(`archives/${Date.now()}.db`)
    .then(() => {
      console.log('backup complete!');
    })
    .catch((err) => {
      console.log('backup failed:', err);
    });
}

function countLinesInDB(db){
  return ((db.prepare('SELECT COUNT(*) FROM list').get())['COUNT(*)'])
}

// --------------------
// Discord Client Login
// --------------------

client.login(config.auth_token);
