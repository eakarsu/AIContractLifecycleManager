'use strict';
const router=require('express').Router();const auth=require('../middleware/auth');const{buildObligationCalendar}=require('../services/obligationCalendar');
router.post('/preview',auth,(req,res)=>{try{res.json(buildObligationCalendar(req.body||{}));}catch(error){res.status(422).json({error:error.message});}});
module.exports=router;
