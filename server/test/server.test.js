const expect = require('expect');
const request = require('supertest');
const {app} = require('../server.js');
const {Todo} = require('../models/todo');
const {User} = require('../models/user');
const {ObjectID} = require('mongodb');
const {todos, populateTodos, users, populateUsers} = require('./seed/seed');

beforeEach(populateUsers);
beforeEach(populateTodos);

/******************************************************************************/
describe('POST /todos', () => {

    it('should create a new todo', (done) => {
        var text = 'This is test text';
        request(app)
            .post('/todos')
            .set('x-auth', users[0].tokens[0].token)
            .send({text})
            .expect(200)
            .expect((response) => {
                expect(response.body.text).toBe(text);
            })
            .end((error, response) => {
                if (error)
                    return done(error);

                Todo.find().then((todos) => {
                    expect(todos.length).toBe(3);
                    expect(todos[2].text).toBe(text);
                    done();
                }).catch((error) => done(error));
            });
    });

    it('should not create a todo because of invalid data', (done) => {
        request(app)
            .post('/todos')
            .set('x-auth', users[0].tokens[0].token)
            .send({})
            .expect(400)
            .end((error, response) => {
                if (error)
                    return done(error);
                Todo.find().then((todos) => {
                    expect(todos.length).toBe(2);
                    done();
                }).catch((error) => done(error));
            });
    });
});
/******************************************************************************/
describe('GET /todos', () => {

    it('should retrun all todos', (done) => {
        request(app)
            .get('/todos')
            .set('x-auth', users[0].tokens[0].token)
            .expect(200)
            .expect((response) => {
                expect(response.body.todos.length).toBe(1);
            })
            .end(done);
    });
});
/******************************************************************************/
describe('GET /todos/:id', () => {

    it('should return 404 for invalid ObjectID', (done) => {
        request(app)
            .get('/todos/wrongid')
            .set('x-auth', users[0].tokens[0].token)
            .expect(404)
            .end(done);
    });

    it('should return 404 for ObjectID not found', (done) => {
        var hexId = new ObjectID().toHexString();

        request(app)
            .get(`/todos/${hexId}`)
            .set('x-auth', users[0].tokens[0].token)
            .expect(404)
            .end(done);
    });
    
    it('should return todo with 200 or valid ObjectID', (done) => {
        request(app)
            .get(`/todos/${todos[0]._id.toHexString()}`)
            .set('x-auth', users[0].tokens[0].token)
            .expect(200)
            .expect((response) => {
                expect(response.body._id).toBe(todos[0]._id.toHexString());
                expect(response.body.text).toBe(todos[0].text);
            })
            .end(done);
    });

    it('should not return todo created by another user', (done) => {
        request(app)
            .get(`/todos/${todos[1]._id.toHexString()}`)
            .set('x-auth', users[0].tokens[0].token)
            .expect(404)
            .end(done);
    });
});
/******************************************************************************/
describe('DELETE /todos/:id', () => {
    it('should return a 404 for invalid ObjectID', (done) => {
        request(app)
            .delete('/todos/123abc')
            .set('x-auth', users[1].tokens[0].token)
            .expect(404)
            .end(done);
    });

    it('should return a deleted todo', (done) => {
        var hexId = todos[1]._id.toHexString();

        request(app)
            .delete(`/todos/${hexId}`)
            .set('x-auth', users[1].tokens[0].token)
            .expect(200)
            .expect((response) => {
                expect(response.body._id).toBe(hexId);
            })
            .end((error, response) => {
                if (error)
                    return done(error);
                
                Todo.findById(hexId).then((todo) => {
                    expect(todo).toNotExist();
                    done();
                }).catch((error) => done(error));
            });
    });

    it('should not delete a todo created by another user', (done) => {
        var hexId = todos[1]._id.toHexString();

        request(app)
            .delete(`/todos/${hexId}`)
            .set('x-auth', users[0].tokens[0].token)
            .expect(404)
            .end((error, response) => {
                if (error)
                    return done(error);
                
                Todo.findById(hexId).then((todo) => {
                    expect(todo).toExist();
                    done();
                }).catch((error) => done(error));
            });
    });


    it('should return a 404 for ObjectID not found', (done) => {
        var hexId = new ObjectID().toHexString();

        request(app)
            .delete(`/todos/${hexId}`)
            .set('x-auth', users[1].tokens[0].token)
            .expect(404)
            .end(done);
    });
});
/******************************************************************************/
describe('PATCH /todos/:id', () => {
    it('should return a 404 for invalid ObjectID', (done) => {
        var text = 'This should be the new text';
        request(app)
            .patch(`/todos/invalidId`)
            .set('x-auth', users[1].tokens[0].token)
            .send({
                completed: true,
                text
            })
            .expect(404)
            .end(done);
    });

    it('should return a updated todo', (done) => {
        var hexId = todos[0]._id.toHexString();
        var text = 'This should be the new text';

        request(app)
            .patch(`/todos/${hexId}`)
            .set('x-auth', users[0].tokens[0].token)
            .send({
                completed: true,
                text
            })
            .expect(200)
            .expect((response) => {
                expect(response.body.todo.text).toBe(text);
                expect(response.body.todo.completed).toBe(true);
                expect(response.body.todo.completedAt).toBeA('number');
            })
            .end(done);
    });

    it('should not update a todo created by another user', (done) => {
        var hexId = todos[0]._id.toHexString();
        var text = 'This should be the new text';

        request(app)
            .patch(`/todos/${hexId}`)
            .set('x-auth', users[1].tokens[0].token)
            .send({
                completed: true,
                text
            })
            .expect(404)
            .end((error, response) => {
                if (error)
                    return done(error);
                
                Todo.findById(hexId).then((todo) => {
                    expect(todo.completed).toBe(false);
                    expect(todo.text).toNotBe(text);
                    expect(todo.completedAt).toNotExist();
                    done();
                }).catch((error) => done(error));
            });
    });

    it('should clear completedAt when todo is not completed', (done) => {
        var hexId = todos[1]._id.toHexString();
        var text = 'This should be the new text';

        request(app)
            .patch(`/todos/${hexId}`)
            .set('x-auth', users[1].tokens[0].token)
            .send({
                completed: false,
                text
            })
            .expect(200)
            .expect((response) => {
                expect(response.body.todo.text).toBe(text);
                expect(response.body.todo.completed).toBe(false);
                expect(response.body.todo.completedAt).toNotExist();
            })
            .end(done);
    });

    it('should return a 404 for ObjectID not found', (done) => {
        var hexId = new ObjectID().toHexString();
        var text = 'This should be the new text';

        request(app)
            .patch(`/todos/${hexId}`)
            .set('x-auth', users[1].tokens[0].token)
            .send({
                completed: true,
                text
            })
            .expect(404)
            .end(done);        
    });
});
/******************************************************************************/
describe('POST /users', () => {
    it('should create a user', (done) => {
        var email = 'himanshu@example.com';
        var password = 'somepass123';
        request(app)
            .post('/users')
            .send({
                email,
                password
            })
            .expect(200)
            .expect((response) => {
                expect(response.body.email).toBe(email);
                expect(response.headers['x-auth']).toExist();
                expect(response.body._id).toExist();
            })
            .end((error) => {
                if (error)
                    return done(error);
                
                User.findOne({email}).then((user) => {
                    expect(user).toExist();
                    expect(user.password).toNotBe(password);
                    done();
                }).catch((error) => done(error));
            });
    });

    it('should return validation errors if request is invalid', (done) => {
        var email = 'someinvalidemail';
        var password = 'someinvalidpass';
        request(app)
            .post('/users')
            .send({email, password})
            .expect(400)
            .expect((response) => {
                expect(response.body).toExist();
            })
            .end(done);
            
    });

    it('should not create a user if email in use', (done) => {
        var email = 'userone@example.com';
        var password = 'someinvalidpass';
        request(app)
            .post('/users')
            .send({email, password})
            .expect(400)
            .expect((response) => {
                expect(response.body).toExist();
            })
            .end(done);
    });
});
/******************************************************************************/
describe('GET /users/me', () => {
    it('should return a user if authenticated', (done) => {
        request(app)
            .get('/users/me')
            .set('x-auth', users[0].tokens[0].token)
            .expect(200)
            .expect((response) => {
                expect(response.body._id).toBe(users[0]._id.toHexString());
                expect(response.body.email).toBe(users[0].email);
            })
            .end(done);
    });

    it('should return 401 for not authenticated', (done) => {
        request(app)
            .get('/users/me')
            .set('x-auth', 'some.invaild.token')
            .expect(401)
            .expect((response) => {
                expect(response.body).toEqual({});
            })
            .end(done);
    });
});
/******************************************************************************/
describe('POST /users/login', () => {
    it('should login user and return auth token', (done) => {
        request(app)
            .post('/users/login')
            .send({
                email: users[1].email,
                password: users[1].password
            })
            .expect(200)
            .expect((response) => {
                expect(response.body._id).toBe(users[1]._id.toHexString());
                expect(response.body.email).toBe(users[1].email);
                expect(response.headers['x-auth']).toExist();
            })
            .end((error, response) => {
                if (error)
                    return done(error);
                
                User.findById(users[1]._id).then((user) => {
                    expect(user.tokens[1]).toInclude({
                        access: 'auth',
                        token: response.headers['x-auth']
                    });
                    done();
                }).catch((error) => done(error));
            });
    });

    it('should reject login request for invalid data', (done) => {
        request(app)
            .post('/users/login')
            .send({
                email: users[1].email,
                password: users[1].password + '1'
            })
            .expect(400)
            .expect((response) => {
                expect(response.headers['x-auth']).toNotExist();
            })
            .end((error, response) => {
                if (error)
                    return done(error);
                
                User.findById(users[1]._id).then((user) => {
                    expect(user.tokens.length).toBe(1);
                    done();
                }).catch((error) => done(error));
            });
    });
});
/******************************************************************************/
describe('DELETE /users/me/token', () => {
    it('should logout a user and delete token from database', (done) => {
        request(app)
            .delete('/users/me/token')
            .set('x-auth', users[0].tokens[0].token)
            .expect(200)
            .end((error, response) => {
                if (error)
                    return done(error);
                
                User.findById(users[0]._id).then((user) => {
                    expect(user.tokens.length).toBe(0);
                    done();
                }).catch((error) => done(error));
            });

    });
});