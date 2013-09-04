var utils = require('./utils');

function getHomePage(req, res) {
  res.send(200, 'This is where the home page will be.');
}

function getRegister(req, res) {
  //TODO Code a real sign up page.
  res.render('index', {
        'fromsignup': true
      });
}

function postRegister(req, res) {
  //TODO change those horrible signup...
  var username        = req.body.signupusername;
  var email           = req.body.signupuseremail;
  var password        = req.body.signuppassword;
  var passwordConfirm = req.body.signuppasswordconfirm

  var validUserForm = utils.isValidUserForm(username,
      email, password, passwordConfirm);

  if (validUserForm === null) { //TODO handle errors
     // Username availability and saving
    var User = db.model('User', schemas.userSchema);
    User.findOne({ name : username },
      function(err, user) {
        if (user) {
          res.render('index', { //TODO render proper register page
            message    : 'Username ' + user + ' already taken',
            fromsignup : true
          });
        } else {
        var newUser = new User({
          name     : username,
          password : password,
          email    : email
        });
        newUser.save(function(err) {
          if (err) {
            appLogger.error('Registration - ' + err.toString());
            res.render('index', {
              message : 'Something went wrong. The great ASQ Server said: '
                  + err.toString()
            });
          }
          req.login(newUser, function(err) {
            if (err) {
              appLogger.error('First login - ' + err.toString());
              res.render('index', {
              message : 'Something went wrong. The great ASQ Server said: '
                  + err.toString()
              });
            }
            res.redirect('/' + username
                + '/?alert=Registration Succesful&type=success');
          });
        });
      }
    });
  }
} 

function getSignIn(req, res) {
  res.render('index', {
      fromsignup : true
    });
}

function postSignIn(req, res) {
  var redirect_to = req.session.redirect_to ? 
      req.session.redirect_to : '/user/' + req.body.username + '/' ;
  res.redirect(redirect_to);
}

function signOut(req, res) {
  req.logout();
  res.redirect('/');
}
