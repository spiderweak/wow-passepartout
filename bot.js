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
const dgm_arg = require('./dgm_arg.json');

// --------------------
// Backup of current list and archives
// --------------------

const current_list = new Database('current.db', { verbose:console.log})
const ok_list = new Database('current_ok.db', { verbose:console.log})

// --------------------
// Discord Client Handling
// --------------------

client.on('ready', () => {

  // Check if the table "points" exists.
  var table = current_list.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = 'list';").get();
  if (!table['count(*)']) {
    // If the table isn't there, create it and setup the database correctly.
    current_list.prepare("CREATE TABLE list (name TEXT PRIMARY KEY, quantity INTEGER);").run();
    // Ensure that the "id" row is always unique and indexed.
    //current_list.prepare("CREATE UNIQUE INDEX idx_names_id ON list (name);").run();
    current_list.pragma("synchronous = 1");
  }

  table = ok_list.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = 'list';").get();
  if (!table['count(*)']) {
    // If the table isn't there, create it and setup the database correctly. 
    ok_list.prepare("CREATE TABLE list (name TEXT PRIMARY KEY, quantity INTEGER);").run();
    // Ensure that the "id" row is always unique and indexed. 
    //ok_list.prepare("CREATE UNIQUE INDEX idx_names_id ON list (name);").run();
    ok_list.pragma("synchronous = 1");
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

  if (!(receivedMsg.member.roles.find(r => r.name === "Coloc"))) return;

  const logs = receivedMsg.guild.channels.find(channel => channel.name === "dgm-logs");
  if (!logs) console.log('The logs channel does not exist and cannot be created');

  if (receivedMsg.content.indexOf(config.prefix) === 0) processCmd(receivedMsg, logs) // Process if starts with configured prefix

//  console.log(receivedMsg.mentions.members.first())

//  if (receivedMsg.mentions.members.users === 2 && )
//    return message.reply("Please mention a user to kick");
});


// --------------------
// Functions
// --------------------

function processCmd(receivedMsg, logChan){
  let fullCmd = receivedMsg.content.substr(1) // Removes "!"
  let splitCmd = fullCmd.split(" ") // Split using spaces
  let primaryCmd = splitCmd[0] // First word determines action
  let args = splitCmd.slice(1) // All others are arguments for the primary command

  console.log("Command Received " + primaryCmd)
  console.log("Arguments : " + args)

  if (primaryCmd === "help" || primaryCmd === "h") {
    helpCmd(args, receivedMsg, logChan)
  } else if (primaryCmd == "dgm") {
    groceriesHandlingCmd(args, receivedMsg, logChan)
  } else {
    logChan.send("I didn't understand. Try `!help`")
  }
}

function helpCmd(args, receivedMsg, logChan) {
  if (args.length > 0) {
    if (args[0] === "help" || args[0] === "h") {
      helpCmd(args.slice(1), receivedMsg, logChan)
    } else {
      var handled_command_array = []
      for (var index=0; index < main_arg['command'].length; index++) {
        handled_command_array.push(main_arg['command'][index]['name'])
        Array.prototype.push.apply(handled_command_array, main_arg['command'][index]['shortcut']);      
      }
      if (handled_command_array.includes(args[0])) {
        if (args[0] === "dgm") {
          logChan.send("I can help you with that, here is how " + args[0] + " works :")
          for (var index=0; index < dgm_arg['command'].length; index++) {
            logChan.send("" + (dgm_arg['command'][index]['name']) + " : " + (dgm_arg['command'][index]['desc']))
          }
        }
      } else {
        logChan.send("I do not provide help for this function, seems I don't know how to use it either")
      }
    }
  } else {
    logChan.send("Here is the list of commands I can handle")
    for (var index=0; index < main_arg['command'].length; index++) {
      logChan.send("" + (main_arg['command'][index]['name']) + " : " + (main_arg['command'][index]['desc']))
    }
  }
}

function groceriesHandlingCmd(args, receivedMsg, logChan) {
  if (args.length > 0) {
    switch (args[0]) {
      case "list":
      case "ls":
        if (args.length > 1) {
          if (args[1] === "ok" || args[1] === "Ok" || args[1] === "OK") logChan.send(JSON.stringify(dumpDB(ok_list)))
        } else {
          logChan.send(JSON.stringify(dumpDB(current_list)))
        }
        break;
      case "add":
      case "a":
        if (args.length > 1) {
          quantity = (args.length > 2 && !(isNaN(parseInt(args[2])))) ? parseInt(args[2]) : 1
          insertInDB({'name':args[1], 'quantity':quantity},current_list)
          logChan.send("Added " + quantity + " of " + args[1] + " to the grocery list")
        } else {
          logChan.send("Nothing to add to the grocery list")
        }
        break;
      case "ok":
        if (args.length > 1) {
          if (existsInDB(args[1], current_list)) {
            quantity = (args.length > 2 && !(isNaN(parseInt(args[2])))) ? parseInt(args[2]) : getQuantityInDB(args[1], current_list)
            insertInDB({'name':args[1], 'quantity':quantity}, ok_list)
            removeFromDB({'name':args[1], 'quantity':quantity}, current_list)
            logChan.send("Moved " + quantity + " of " + args[1] + " from the grocery list")
          } else {
            quantity = (args.length > 2 && !(isNaN(parseInt(args[2])))) ? parseInt(args[2]) : 1
            insertInDB({'name':args[1], 'quantity':quantity}, ok_list)
            logChan.send("Moved " + quantity + " of " + args[1] + " from the grocery list")
          }
        } else {
          logChan.send("Nothing to move to the OK list")
        }        
        break;
      case "nok":
        if (args.length > 1) {
          quantity = (args.length > 2 && !(isNaN(parseInt(args[2])))) ? parseInt(args[2]) : getQuantityInDB(args[1], ok_list)
          insertInDB({'name':args[1], 'quantity':quantity}, current_list)
          removeFromDB({'name':args[1], 'quantity':quantity}, ok_list)
          logChan.send("Moved " + quantity + " of " + args[1] + " from the OK list to the grocery List")
        } else {
          logChan.send("Nothing to move from the OK list")
        } 
        break;
      case "all_ok":
//        for (var index=0; index < countLinesInDB(current_list); index++) {
//          handleGroceriesCmd(["ok",, receivedMsg, logChan)
//        }
        break;
      case "delete":
      case "del":
      case "d":
      case "rm":
        if (args.length > 1) {
          quantity = (args.length > 2 && !(isNaN(parseInt(args[2])))) ? parseInt(args[2]) : getQuantityInDB(args[1], current_list)
          removeFromDB({'name':args[1], 'quantity':quantity}, current_list)
          logChan.send("Removed " + quantity + " of " + args[1] + " from the grocery list")
        } else {
          logChan.send("Nothing to add to the grocery list")
        }
        break;
      case "pay":
         backupDB(ok_list) 
         logChan.send("Thanks for doing the groceries, don't forget to add the amount paid on Splitwise")
         flushDB(ok_list)
        break;
      case "flush":
        if (args.length > 1) {
          if (args[1] === "ok" || args[1] === "Ok" || args[1] === "OK") flushDB(ok_list)
        } else {
          flushDB(current_list)
        }
        break;
      case "h":
        helpCmd(["dgm"], receivedMsg, logChan)
        break;
      default:
        logChan.send("I do not understand this command, if it is right, contact the bot programmer for debug");
    }
  } else {
    logChan.send("Don't you know how to handle the grocery list ?")
    helpCmd(["dgm"], receivedMsg, logChan)
  }
}


// --------------------
// Database Specific Fct
// --------------------

function existsInDB(name_to_test, db) {
  const selectStatement = db.prepare('SELECT quantity FROM list WHERE name = ?');
  const quantity = selectStatement.get(name_to_test)
  if (quantity === undefined) return false
  return true
}

function getQuantityInDB(name_to_test, db) {
  const selectStatement = db.prepare('SELECT quantity FROM list WHERE name = ?');
  const quantity = selectStatement.get(name_to_test)
  if (quantity === undefined) return 0
  return quantity['quantity']
}

function insertInDB(item, db) {
  if (existsInDB(item['name'], db)) {
  updateInDB(item, db)
  } else {
  const insertStatement = db.prepare('INSERT INTO list (name, quantity) VALUES (@name, @quantity)');
  console.log(item)
  insertStatement.run(item)
  }
}

function insertManyInDB(list, db) {
  const insertStatement = db.prepare('INSERT INTO list (name, quantity) VALUES (@name, @quantity)');
  
  const insertMany = db.transaction((list) => {
    for (const item of list) insertStatement.run(item);
  });
}

function updateInDB(item, db) {
  const selectStatement = db.prepare('SELECT quantity FROM list WHERE name = ?');
  const quantity = selectStatement.get(item['name'])
  if (quantity === undefined) {
    console.log("Item does not exist, Inserting instead")
    insertInDB(item,db)
  } else {
    const updateStatement = db.prepare('UPDATE list SET quantity = ? WHERE name = ?');
    updateStatement.run(quantity['quantity']+item['quantity'], item['name'])
  }
}

function removeFromDB(item, db) {
  const selectStatement = db.prepare('SELECT quantity FROM list WHERE name = ?');
  const quantity = selectStatement.get(item['name'])
  if (quantity === undefined) {
    console.log("Item does not exist")
  } else if (item['quantity'] <= 0 || quantity['quantity'] - item['quantity'] <= 0) {
    name_to_delete = item['name']
    const deleteStatement = db.prepare('DELETE FROM list WHERE name = ?');
    deleteStatement.run(name_to_delete)
  } else {
    const updateStatement = db.prepare('UPDATE list SET quantity = ? WHERE name = ?');
    updateStatement.run(quantity['quantity']-item['quantity'], item['name'])
  }
}

function dumpDB(db){
  return db.prepare('SELECT name, quantity FROM list').all()
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
