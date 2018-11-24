import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

class UserData {
    _id: any;
    username: string;
    userType: string;
}
@Injectable({
    providedIn: 'root'
})
export class LoginService {
    public loggedin: boolean = false;
    user: UserData = null;
    constructor(private http:HttpClient) {
    }
    login(username: String, password: String) {
        return new Promise((resolve, reject) => {
            this.http.post("/login", {
                "username":username, "password":password
            }, {
                observe:'response',
                withCredentials: true
            }).subscribe(httpResponse => {
                if (httpResponse.body["message"] == "login succesful") {
                    this.loggedin = true;
                    let u = httpResponse.body["user"];
                    this.user = {
                        _id: u._id,
                        username: u.username,
                        userType: u.userType
                    };
                    resolve("Login Succesful");
                } else {
                    reject("Invalid Credentials");
                }
            }, (_) => { // error
                reject("something went wrong... :/");
            });
        });
    }
    async register(username: String, password: String, userType:String) {
        return new Promise((resolve, reject) => 
            this.http.post("/register", {"username": username, "password":password, "userType":userType})
            .subscribe(resolve, reject)
        );
    }
    logOut() {
        return new Promise((resolve, reject) => {
            this.http.post("/logout", {},{observe:"response"}).subscribe((httpResponse) => {
                if (httpResponse.status == 200) {
                    this.loggedin = false;
                    resolve(true);
                } else reject(httpResponse.statusText);
            }, (err) => reject(err));
        });
    }
}
