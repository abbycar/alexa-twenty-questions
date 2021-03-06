var Alexa = require("alexa-sdk");
var request = require("request");

var alexa;

var states = {
    NEWGAMEMODE: "_NEWGAMEMODE",
    GUESSMODE: "_GUESSMODE",
    CLUEMODE: "_CLUEMODE",
    WINMODE: "_WINMODE",
    LOSEMODE: "_LOSEMODE"
};

exports.handler = function (event, context, callback) {
    alexa = Alexa.handler(event, context);
    // alexa.appId = "amzn1.ask.skill.1e0180c4-424d-498d-83f1-f952b1cb77e8";
    // alexa.dynamoDBTableName = "TwentyQuestions";
    alexa.registerHandlers(newSessionHandler, newGameHandler, guessHandler, clueHandler, winHandler, loseHandler);
    alexa.execute();
};

var databaseLocation = "https://raw.githubusercontent.com/mbmccormick/alexa-twenty-questions/master/cards.json";

var database;
var card;

var newSessionHandler = {
    "NewSession": function () {
        printDebugInformation(this, "newSessionHandler:NewSession");

        this.handler.state = states.NEWGAMEMODE;

        downloadDatabase(function (size) {
            alexa.emit(":ask", "Welcome to Twenty Questions! Are you ready to play?", "Are you ready to play?");
        });
    },
    "Unhandled": function () {
        printDebugInformation(this, "newSessionHandler:Unhandled");

        this.emit("NewSession");
    }
};

var newGameHandler = Alexa.CreateStateHandler(states.NEWGAMEMODE, {
    "AMAZON.YesIntent": function () {
        printDebugInformation(this, "newGameHandler:AMAZON.YesIntent");

        var index = getRandomNumber(1, database.length);
        card = database[index - 1];
        
        this.attributes["CARD_ID"] = card.id;
        this.attributes["READ_CLUES"] = [];
        this.attributes["CURRENT_CLUE"] = null;

        this.handler.state = states.GUESSMODE;

        this.emit(":ask", "OK, let's begin. I am a " + card.type + ". Take your first guess.", "Please take your first guess.");
    },
    "AMAZON.NoIntent": function () {
        printDebugInformation(this, "newGameHandler:AMAZON.NoIntent");

        this.emitWithState("SessionEndedRequest");
    },
    "AMAZON.HelpIntent": function () {
        printDebugInformation(this, "newGameHandler:AMAZON.HelpIntent");

        this.emitWithState("Unhandled");
    },
    "AMAZON.StopIntent": function () {
        printDebugInformation(this, "newGameHandler:AMAZON.StopIntent");

        this.emitWithState("SessionEndedRequest");
    },
    "SessionEndedRequest": function () {
        printDebugInformation(this, "newGameHandler:SessionEndedRequest");

        this.handler.state = null;
        
        this.emit(":tell", "OK, come back soon.");
    },
    "Unhandled": function () {
        printDebugInformation(this, "newGameHandler:Unhandled");

        this.emit(":ask", "You can say yes to begin the game or no to quit.", "You can say yes to begin the game or no to quit.");
    }
});

var guessHandler = Alexa.CreateStateHandler(states.GUESSMODE, {
    "GUESS": function () {
        printDebugInformation(this, "guessHandler:GUESS");

        var slots = this.event.request.intent.slots;

        var isCorrect = false;
        for (var slot in slots) {
            if (slots.hasOwnProperty(slot)) {
                if (slots[slot].value) {
                    var guess = slots[slot].value;

                    if (find(card.answers, guess)) {
                        isCorrect = true;
                    }
                }
            }
        }

        if (isCorrect) {
            this.handler.state = states.WINMODE;

            this.emitWithState("LaunchRequest");
        } else {
            if (this.attributes["READ_CLUES"].length < 20) {
                this.handler.state = states.CLUEMODE;

                this.emit(":ask", "No, that's not it. Choose a clue number between 1 and 20 to continue.", "Please choose a clue number between 1 and 20.");
            } else {
                this.handler.state = states.LOSEMODE;

                this.emitWithState("LaunchRequest");
            }
        }
    },
    "REPEAT": function () {
        printDebugInformation(this, "guessHandler:REPEAT");

        this.emit(":ask", "Your last clue was: " + card.clues[this.attributes["CURRENT_CLUE"] - 1] + " Take your guess.", "Please take your guess.");
    },
    "READALL": function () {
        printDebugInformation(this, "guessHandler:READALL");

        var message = "";

        for (var clue in this.attributes["READ_CLUES"].sort(sortNumbers)) {
            message += "Clue number " + clue + ": " + card.clues[clue - 1] + " ";
        }

        this.emit(":ask", message + "Take your guess.", "Please take your guess.");
    },
    "AMAZON.HelpIntent": function () {
        printDebugInformation(this, "guessHandler:AMAZON.HelpIntent");

        this.emitWithState("Unhandled");
    },
    "AMAZON.StopIntent": function () {
        printDebugInformation(this, "guessHandler:AMAZON.StopIntent");

        this.emitWithState("SessionEndedRequest");
    },
    "SessionEndedRequest": function () {
        printDebugInformation(this, "guessHandler:SessionEndedRequest");

        this.handler.state = null;

        this.emit(":tell", "OK, come back soon.");
    },
    "Unhandled": function () {
        printDebugInformation(this, "guessHandler:Unhandled");

        this.emit(":ask", "You can say repeat that to repeat the last clue or read all clues to read all of your clues.", "You can say repeat that to repeat the last clue or read all clues to read all of your clues.");
    }
});

var clueHandler = Alexa.CreateStateHandler(states.CLUEMODE, {
    "CLUE": function () {
        printDebugInformation(this, "clueHandler:CLUE");

        var number = this.event.request.intent.slots.number.value;

        if (number >= 1 &&
            number <= 20) {
            if (find(this.attributes["READ_CLUES"], number) == false) {
                this.attributes["READ_CLUES"].push(number);
                this.attributes["CURRENT_CLUE"] = number;

                this.handler.state = states.GUESSMODE;

                this.emit(":ask", card.clues[number - 1] + " Take your guess.", "Please take your guess.");
            } else {
                this.emit(":ask", "You've already had this clue. Please choose a different clue number.", "Please choose a clue number between 1 and 20.");
            }
        } else {
            this.emit(":ask", "Sorry, please choose a clue number between 1 and 20.", "Please choose a clue number between 1 and 20.");
        }
    },
    "REPEAT": function () {
        printDebugInformation(this, "clueHandler:REPEAT");

        this.emit(":ask", "Your last clue was: " + card.clues[this.attributes["CURRENT_CLUE"] - 1] + " Choose a clue number between 1 and 20.", "Please choose a clue number between 1 and 20.");
    },
    "READALL": function () {
        printDebugInformation(this, "clueHandler:READALL");

        var message = "";

        for (var clue in this.attributes["READ_CLUES"].sort(sortNumbers)) {
            message += "Clue number " + clue + ": " + card.clues[clue - 1] + " ";
        }

        this.emit(":ask", message + "Choose a clue number between 1 and 20.", "Please choose a clue number between 1 and 20.");
    },
    "AMAZON.HelpIntent": function () {
        printDebugInformation(this, "clueHandler:AMAZON.HelpIntent");

        this.emitWithState("Unhandled");
    },
    "AMAZON.StopIntent": function () {
        printDebugInformation(this, "clueHandler:AMAZON.StopIntent");

        this.emitWithState("SessionEndedRequest");
    },
    "SessionEndedRequest": function () {
        printDebugInformation(this, "clueHandler:SessionEndedRequest");

        this.handler.state = null;

        this.emit(":tell", "OK, come back soon.");
    },
    "Unhandled": function () {
        printDebugInformation(this, "clueHandler:Unhandled");

        this.emit(":ask", "Please choose a clue number between 1 and 20.", "Please choose a clue number between 1 and 20.");
    }
});

var winHandler = Alexa.CreateStateHandler(states.WINMODE, {
    "LaunchRequest": function () {
        printDebugInformation(this, "winHandler:LaunchRequest");

        this.handler.state = states.NEWGAMEMODE;

        var score = 20 - this.attributes["READ_CLUES"].length;

        if (score > 1) {
            this.emit(":ask", "Yes, that's right! I am " + card.answers[0] + ". You scored " + score + " points. Would you like to play again?", "Would you like to start a new game?");
        } else {
            this.emit(":ask", "Yes, that's right! I am " + card.answers[0] + ". You scored " + score + " point. Would you like to play again?", "Would you like to start a new game?");
        }
    },
    "AMAZON.YesIntent": function () {
        printDebugInformation(this, "winHandler:AMAZON.YesIntent");

        this.handler.state = states.NEWGAMEMODE;

        this.emitWithState("LaunchRequest");
    },
    "AMAZON.NoIntent": function () {
        printDebugInformation(this, "winHandler:AMAZON.NoIntent");

        this.emitWithState("SessionEndedRequest");
    },
    "AMAZON.HelpIntent": function () {
        printDebugInformation(this, "winHandler:AMAZON.HelpIntent");

        this.emitWithState("Unhandled");
    },
    "AMAZON.StopIntent": function () {
        printDebugInformation(this, "winHandler:AMAZON.StopIntent");

        this.emitWithState("SessionEndedRequest");
    },
    "SessionEndedRequest": function () {
        printDebugInformation(this, "winHandler:SessionEndedRequest");

        this.handler.state = null;

        this.emit(":tell", "OK, come back soon.");
    },
    "Unhandled": function () {
        printDebugInformation(this, "winHandler:Unhandled");

        this.emit(":ask", "You can say yes to start a new game or no to quit.", "You can say yes to start a new game or no to quit.");
    }
});

var loseHandler = Alexa.CreateStateHandler(states.LOSEMODE, {
    "LaunchRequest": function () {
        printDebugInformation(this, "loseHandler:LaunchRequest");

        this.handler.state = states.NEWGAMEMODE;

        this.emit(":ask", "Sorry, that's still not right. Game over. I am " + card.answers[0] + ". Would you like to play again?", "Would you like to start a new game?");
    },
    "AMAZON.YesIntent": function () {
        printDebugInformation(this, "loseHandler:AMAZON.YesIntent");

        this.handler.state = states.NEWGAMEMODE;

        this.emitWithState("LaunchRequest");
    },
    "AMAZON.NoIntent": function () {
        printDebugInformation(this, "loseHandler:AMAZON.NoIntent");

        this.emitWithState("SessionEndedRequest");
    },
    "AMAZON.HelpIntent": function () {
        printDebugInformation(this, "loseHandler:AMAZON.HelpIntent");

        this.emitWithState("Unhandled");
    },
    "AMAZON.StopIntent": function () {
        printDebugInformation(this, "loseHandler:AMAZON.StopIntent");

        this.emitWithState("SessionEndedRequest");
    },
    "SessionEndedRequest": function () {
        printDebugInformation(this, "loseHandler:SessionEndedRequest");

        this.handler.state = null;

        this.emit(":tell", "OK, come back soon.");
    },
    "Unhandled": function () {
        printDebugInformation(this, "loseHandler:Unhandled");

        this.emit(":ask", "You can say yes to start a new game or no to quit.", "You can say yes to start a new game or no to quit.");
    }
});

function printDebugInformation(context, name) {
    if (process.env.DEBUG) {
        console.log(name);

        var intent = context.event.request.intent;

        if (intent) {
            var slots = intent.slots;

            for (var slot in slots) {
                if (slots.hasOwnProperty(slot)) {
                    if (slots[slot].value) {
                        console.log(slots[slot]);
                    }
                }
            }
        }
    }
}

function downloadDatabase(callback) {
    request(databaseLocation, function (err, res, body) {
        database = JSON.parse(body);

        callback();
    });
}

function getRandomNumber(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);

    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function find(array, item) {
    for (var i = 0; i < array.length; i++) {
        if (array[i].toLowerCase() === item.toLowerCase()) {
            return true;
        }
    }

    return false;
}

function sortNumbers(a,b ) {
    return a - b;
}