const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const Category = mongoose.model("category");
const Item = mongoose.model("item");
const Ingredient = mongoose.model("ingredient");
const Option_Menu = mongoose.model("option_menu");
const Option_Item = mongoose.model("option");

// initially has enough ingredients to make this many of all the items on the menu 
const initial_supply_factor = 3;

// borrowed from https://stackoverflow.com/a/15030117
function flatten(arr) {
    return arr.reduce(function (flat, toFlatten) {
          return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
    }, []);
}
/**
 * This file populates the restaraunt database with food/drink/ingredient/menu data in the supplied JSON files
 */
async function drop_everything() {
    return Promise.all([Category, Ingredient, Item].map(model=>
        new Promise((resolve, reject) => 
            model.deleteMany({},err =>
                err? reject(err) : resolve()
            )
        )
    ));
}

async function create_categories(filenames) {
    const category_objects = filenames.map((s) => ({"name":s.slice(0,-5)}));
    return new Promise((resolve, reject) =>
        Category.create(category_objects, (err, created_categories) => {
            let category_names_to_ids = {};
            for (let i=0; i<created_categories.length; i++) {
                category_names_to_ids[created_categories[i].name] = created_categories[i]._id;
            }
            if (err) reject(err);
            else resolve(category_names_to_ids);
        })
    );
}

async function db_save_ingredients() {
    const ingredients_path = path.resolve("data","ingredients");
    const ingredient_filenames = fs.readdirSync(ingredients_path);
    const ingredients_list = await Promise.all(
        ingredient_filenames.map(
            filename=>new Promise((resolve, reject)=> {
                const full_filename = path.join(ingredients_path, filename);
                fs.readFile(full_filename,{"encoding":"utf-8"},(err, data)=>{
                    const parsedData = JSON.parse(data);
                    if (err) reject(err);
                    else resolve(parsedData);
                });
            })
        )
    ).then(flatten);
    return Promise.all(ingredients_list.map(ingredient => {
        Ingredient.create(ingredient);
    }));
}

async function create_option_menus_and_items() {
    const menu_options_dir = path.resolve("data","menu_options");
    const menu_options_filenames = fs.readdirSync(menu_options_dir);
    return Promise.all(menu_options_filenames.map(filename=>
        new Promise((resolve, reject)=>
            fs.readFile(
                path.join(menu_options_dir,filename),{encoding:'utf-8'},
                (err,fileData) => {
                    let data = JSON.parse(fileData);
                    data.name = filename.slice(0,-5);
                    if (err) reject(err);
                    else resolve(data);
                }
            )
        )
    )).then(option_lists =>
        Promise.all(option_lists.map(option_menu =>
            Option_Menu.create(option_menu).then((new_menu)=>{
                // console.log(option_menu.name+":");
                // console.log(option_menu.options);
                return Promise.all(option_menu.options.map(async option_item=>{
                    option_item.category = new_menu._id;
                    if (!option_item.ingredients) {
                        console.log("option_item.ingredients === null!!!");
                        console.log("for option \""+JSON.stringify(option_item)+"\"");
                        console.log("exiting now");
                        process.exit(1);
                    }
                    let new_ingredients = await Promise.all(
                        option_item.ingredients.map(ingredient=>
                            new Promise((resolve, reject)=>{
                                Ingredient.findOne({name:ingredient.name},(err, ingredient_record)=>{
                                    if (err) reject(err);
                                    else if (ingredient_record == null){
                                        console.log("Error while reading "+path.join("server","data","menu_options", option_menu.name+".json")+": "+option_item.name)
                                        reject("no such ingredient found: \""+ingredient.name+"\".");
                                    } else {
                                        ingredient.id = ingredient_record._id;
                                        // console.log("processing ingredient: "+ingredient.name);
                                        delete ingredient.name;
                                        resolve(ingredient);
                                    }
                                });
                            })
                        )
                    );
                    // console.log("new ingredients for "+option_item.name);
                    // console.log(new_ingredients);
                    option_item.ingredients = new_ingredients;
                    return Option_Item.create(option_item).then((result)=>{
                        // console.log("created option: "+option_item.name)
                        return result;
                    }).catch((err)=>{
                        console.log("error on option: "+option_item.name);
                        console.log(JSON.stringify(option_item))
                        console.error(err);
                        return err;
                    });
                }));
            })
        ))
    )
}

async function create_menu_items(filenames, directory, cat_names_to_ids) {
    return Promise.all(filenames.map(filename =>
        new Promise((resolve, reject) => 
            fs.readFile(path.join(directory,filename), (err, data) => {
                if (err) reject(err);
                else resolve({"data":JSON.parse(data),"filename":filename});
            })
        )
    )).then(objects =>
        objects.reduce((prev_items,curr_items_obj)=>{
            for (let i=0; i<curr_items_obj.data.length; i++) {
                curr_items_obj.data[i].category = cat_names_to_ids[curr_items_obj.filename.slice(0,-5)]
            }
            return prev_items.concat(curr_items_obj.data);
        },[])
    ).then(itemList =>
        Promise.all(itemList.map(async item => {
            if (item.ingredients == null) {
                console.log("item.ingredients == null!");
                console.log(item);
            }
            return Promise.all(
                item.ingredients.map(async ingredient=>
                    new Promise((resolve, reject)=>
                        Ingredient.findOne({name:ingredient.name},(err,ingredientRecord)=>{
                            if (err) reject(err);
                            else if (ingredientRecord == null) {
                                console.error("while filling out item \""+item.name+"\",");
                                console.error("no ingredient record found for \""+ingredient.name+"\".");
                                console.error("add an entry in your ingredients files!");
                                // reject(error_message);
                                process.exit(1);
                            }
                            else {
                                ingredient.id = ingredientRecord._id;
                                resolve(ingredient);
                            }
                        })
                    )
                )
            ).then(async updatedIngredients => {
                item.ingredients = updatedIngredients;
                if (item.options == null) {
                    console.log("Item \""+item.name+"\" missing property \"options\"!");
                }
                else if (item.options.map == null) {
                    console.log("something's weird:");
                    console.log(item);
                }
                else return Promise.all(item.options.map(option_name=>
                    new Promise((resolve, reject)=>
                        Option_Menu.findOne({name:option_name}, (err,record)=>{
                            if (err) reject(err);
                            else if (record == null) {
                                console.log("Could not find an option listing by the name of \""+option_name+"\"!");
                                process.exit(1);
                            } 
                            else resolve(record._id);
                        })
                    )
                )).then(option_menu_ids=>
                    item.options = option_menu_ids
                )
            }).then(_=> item);
        }))
    ).then(async preparedItems => {
        console.log("-".repeat(20));
        console.log(preparedItems.length+" Items inserted");
        console.log("-".repeat(20));
        return Item.insertMany(preparedItems);
    });
}

async function main() {
    await drop_everything();
    const menu_item_dir = path.resolve("data","menu_items")
    const menu_item_filenames = fs.readdirSync(menu_item_dir);
    const categories_name_to_id = await create_categories(menu_item_filenames);
    db_save_ingredients();
    await create_option_menus_and_items();
    await create_menu_items(menu_item_filenames, menu_item_dir, categories_name_to_id);
}

module.exports = main;