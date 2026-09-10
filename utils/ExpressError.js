// class ExpressError extends Error{
//     constructor(statusCode,message){
//         super();
//         this.statusCode = statusCode;
//         this.message = message;
//     }
// }

// module.exports =  ExpressError;


// class ExpressError extends Error {
//   constructor(message, statusCode) {
//     super(message);              // Error class ka constructor call
//     this.statusCode = statusCode;
//   }
// }

// module.exports = ExpressError;

class ExpressError extends Error {
  constructor(statusCode, message) {
    super();
    this.statusCode = statusCode;
    this.message = message;
  }
}

module.exports = ExpressError;

