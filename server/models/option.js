let mongoose   = require("mongoose");
let Schema     = mongoose.Schema;
let ForeignKey = Schema.Types.ObjectId;

let option = new Schema({
    name:{
        type:String,
        required:true
    },
    priceCents:{
        type:Number,
        required:true
    },
    menu: {
        type: ForeignKey,
        refPath: 'option_menu',
        required: true
    },
    ingredients:[{
        id:{
            type: ForeignKey,
            required: true,
            ref: 'ingredient'
        },
        quantity:{
            type: Number,
            required: true
        },
        unit:{
            type:String,
            required: true
        }
    }]
})

mongoose.model("option",option);