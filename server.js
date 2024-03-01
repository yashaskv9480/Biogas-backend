const express = require('express');
const cors = require('cors')
const app = express();
const port = process.env.PORT || 3500
const db = require("./db/dbconnect.js")
const jwt = require('jsonwebtoken')


const secretKey = process.env.AUTH_KEY;

app.use(cors())
app.use(express.json())

// Middleware to authenticate JWT tokens
  const authenticateJWT = (req, res, next) => {
      const token = req.header('Authorization');
      if (!token) return res.sendStatus(401);

      jwt.verify(token, secretKey, (err, user) => {
          if (err) return res.sendStatus(403);
          req.user = user;
          next();
      }); 
  };

  app.post("/api/v1/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(email,password)
        const result = await db.query("SELECT uid,name,address,mobile,email FROM user_details WHERE email=($1) AND password=($2)", [email, password]);
        const user = result.rows[0];
        console.log(user)

        if (user) {
            let userType;
            if (email === "admin@gmail.com") {
                userType = "admin";
            } else {
                const result2 = await db.query("SELECT role FROM user_role_management WHERE uid = $1", [user.uid]);
                userType = result2.rows[0].role;
            }
            const token = jwt.sign({ id: user.uid,name:user.name,address:user.address,mobile:user.mobile,email:user.email,type: userType }, secretKey);
            const responseObj = {
                "token": token,
            };

            return res.status(200).json(responseObj);
        }
        return res.status(404).json({ "message": 404 });
    } catch (err) {
        console.log(err.message);
        return res.status(500).json({ error: err.message });
    }
  });


app.get('/api/v1/authenticate', authenticateJWT, (req, res) => {
    res.status(200).json({ message: 'Valid User 👍' });
});


app.get("/api/v1/getdevices",authenticateJWT,async (req, res) => {
  try {
    const token = req.header("Authorization");

    const decodedToken = jwt.verify(token, secretKey);
    const uid = decodedToken.id;
    if(uid == 1) {
               const result = await db.query(`Select * from device`)
               console.log(result.rows)
      res.status(200).json(result.rows)
    }
    else {   
             const query = `
              SELECT d.*
              FROM device d
              JOIN device_management dm ON d.device_id = dm.device_id
              WHERE dm.uid = $1 AND dm.access = $2`;

            const values = [uid, 1];

            const result = await db.query(query, values);
            res.status(200).json(result.rows);
          }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch devices" });
  }
});


app.get("/api/v1/userdetails/:uid", async (req, res) => {
  try {
    const uid = req.params.uid; 
    const response = await db.query("SELECT name,email FROM user_details WHERE uid = $1", [uid]);
    res.json(response.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/v1/adddevice",async (req,res) => {
  try{
      const { device_id, longitude, latitude, description } = req.body;
      const values = [device_id, longitude, latitude, description];
      const query = "INSERT INTO device (device_id, logitude, latitude, description) VALUES ($1, $2, $3, $4)";
      const result = await db.query(query, values);
      console.log(res.status(200).json({
          "message" : "success"
      }));

  }
  catch(err){
      console.log(err)
      res.send(err.message)
  }
})

app.delete("/api/v1/deletedevice/:device_id", async (req, res) => {
  try {
    const { device_id } = req.params;
    const deletemanager = await db.query("DELETE FROM device WHERE device_id = $1", [
      device_id
    ]);
    res.json("Device was deleted!");
  } catch (err) {
    console.log(err.message);
  }
});


app.get("/api/v1/getmanagers",async (req,res) =>{
  try{
      const result = await db.query(`SELECT u.uid, u.name,u.address, u.mobile, u.email
      FROM user_details u
      JOIN user_role_management ur ON u.uid = ur.uid
      WHERE ur.role = 'manager' ;        
      `)


      res.status(200).json(result.rows)
  }
  catch(err){
      console.log(err);
  }
})

app.post("/api/v1/addmanager",async (req,res) => {
  try{
      const { name,password,address,mobile,email,adminId,role } = req.body;
      const values = [name,password,address,mobile,email];
      const query = `INSERT INTO user_details (name, password, address, mobile, email)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING uid;`;
      const result = await db.query(query, values);
      const uid = result.rows[0].uid;
      const values2 = [uid,adminId,role]
      console.log(uid,adminId,role)
      const query2 = `Insert INTO user_role_management(uid,admin_id,role)
      Values ($1,$2,$3) `
      const result2 = await db.query(query2,values2)
      console.log(res.status(200).json({
          "message" : "success",
      }));
  }
  catch(err){
      console.log(err.me)
      res.send(err.message)
  }
})

app.delete("/api/v1/deletemanager/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const deleterole = await db.query ("DELETE from user_role_management where uid = $1",[uid]);
    const deletemanager = await db.query("DELETE FROM user_details WHERE uid = $1", [
      uid
    ]);
    res.json("Manager was deleted!");
  } catch (err) {
    console.log(err.message);
  }
});




app.get("/api/v1/sensor_values", async (req, res) => {
  try {
    const result = await db.query(`
    SELECT
    sv.device_id AS "device_id",
    MAX(CASE WHEN sp.reg_add = '0' AND sv.slave_id = '3' THEN sv.value END) AS "r",
    MAX(CASE WHEN sp.reg_add = '2' AND sv.slave_id = '3' THEN sv.value END) AS "y",
    MAX(CASE WHEN sp.reg_add = '4' AND sv.slave_id = '3' THEN sv.value END) AS "b",
    MAX(CASE WHEN sp.reg_add = '56' AND sv.slave_id = '3' THEN sv.value END) AS "frequency",
    MAX(CASE WHEN sp.reg_add = '2' AND sv.slave_id = '2' THEN sv.value END) AS "ph",
    MAX(CASE WHEN sp.reg_add = '3' AND sv.slave_id = '2' THEN sv.value END) AS "temperature",
    MAX(CASE WHEN sp.reg_add = '0' AND sv.slave_id = '7' THEN sv.value END) AS "weight",
    MAX(TO_TIMESTAMP(sv.d_time, 'DD/MM/YY HH24:MI:SS')) AS "dtime"
FROM
    sensor_value sv
JOIN
    sensor_parameters sp ON sv.device_id = sp.device_id AND sv.slave_id = sp.slave_id AND sv.reg_add = sp.reg_add
WHERE
    sv.device_id = '1014'
GROUP BY
    sv.device_id, sv.d_time
ORDER BY
    "dtime" DESC;

    `);

    console.log(result.rows);
    res.json(result.rows);
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/v1/dashboard/", async(req,res) =>{
    try{
        const result = await db.query(` SELECT
        sv.device_id AS "device_id",
        MAX(CASE WHEN sp.reg_add = '0' AND sv.slave_id = '3' THEN sv.value END) AS "r",
        MAX(CASE WHEN sp.reg_add = '2' AND sv.slave_id = '3' THEN sv.value END) AS "y",
        MAX(CASE WHEN sp.reg_add = '4' AND sv.slave_id = '3' THEN sv.value END) AS "b",
        MAX(CASE WHEN sp.reg_add = '56' AND sv.slave_id = '3' THEN sv.value END) AS "frequency",
        MAX(CASE WHEN sp.reg_add = '2' AND sv.slave_id = '2' THEN sv.value END) AS "ph",
        MAX(CASE WHEN sp.reg_add = '3' AND sv.slave_id = '2' THEN sv.value END) AS "temperature",
        MAX(CASE WHEN sp.reg_add = '0' AND sv.slave_id = '7' THEN sv.value END) AS "weight",
        MAX(TO_TIMESTAMP(sv.d_time, 'DD/MM/YY HH24:MI:SS')) AS "dtime"
    FROM
        sensor_value sv
    JOIN
        sensor_parameters sp ON sv.device_id = sp.device_id AND sv.slave_id = sp.slave_id AND sv.reg_add = sp.reg_add
    WHERE
        sv.device_id = '1014'
    GROUP BY
        sv.device_id, sv.d_time
    ORDER BY
        "dtime" DESC
    LIMIT 1;
    
    `)
    res.status(200).json(result.rows)
    }
    catch(err){
        console.log(err.message)
    }
})

app.get("/api/v1/dashboard/:deviceid", async (req, res) => {
  try { 
      const deviceId = req.params.deviceid;
      const query = `
      SELECT
          slave_id,
          array_agg(reg_add ORDER BY reg_add) AS reg_addresses,
          array_agg(keys ORDER BY reg_add) AS keys
      FROM
          sensor_parameters
      WHERE
          device_id = $1
      GROUP BY
          slave_id
      `;
      
     const result = await db.query(query, [deviceId]);
      const sensorParamsQuery = await db.query(`
          SELECT
              sv.device_id AS "device_id",
              ${generateSelectClauses(result.rows)},
              MAX(TO_TIMESTAMP(sv.d_time, 'DD/MM/YY HH24:MI:SS')) AS "dtime"
          FROM
              sensor_value sv
          JOIN
              sensor_parameters sp ON sv.device_id = sp.device_id AND sv.slave_id = sp.slave_id AND sv.reg_add = sp.reg_add
          WHERE
              sv.device_id = $1
          GROUP BY
              sv.device_id, sv.d_time
          ORDER BY
              "dtime" DESC
          LIMIT 1;
      `, [deviceId]);

      res.status(200).json(sensorParamsQuery.rows);
  } catch (err) {
      console.error(err.message);
      res.status(500).json({ error: "Internal Server Error" });
  }
});

function generateSelectClauses(sensorParams) {
      const selectClauses = sensorParams.map(params => {
      const { slave_id, reg_addresses, keys } = params;
      return reg_addresses.map((reg_add, index) => `
          MAX(CASE WHEN sp.reg_add = '${reg_add}' AND sv.slave_id = '${slave_id}' THEN sv.value END) AS "${keys[index]}"`).join(',');
  }).join(',');

  return selectClauses;
}




app.post("/api/v1/todo", async (req, res) => {
    try {
      const { user_name, description,end_date} = req.body;
      const newTodo = await db.query(
        "INSERT INTO todo (user_name, description,end_date) VALUES($1, $2,$3) RETURNING *",
        [user_name, description,end_date]
      );
  
      res.json(newTodo.rows[0]);
      console.log(req.body)
    } catch (err) {
      console.error(err.message);
    }
  });

app.put('/api/v1/todo/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { completed } = req.body;
  
      const updateTodo = await db.query(
        'UPDATE todo SET completed = $1 WHERE todo_id = $2 RETURNING *',
        [completed, id]
      );
  
      res.json(updateTodo.rows[0]);
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
  
  
  app.get("/api/v1/todo", async (req, res) => {
    try {
      const allTodos = await db.query("SELECT * FROM todo");
      res.json(allTodos.rows);
    } catch (err) {
      console.error(err.message);
    }
  });
  
  
  app.delete("/api/v1/todo/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleteTodo = await db.query("DELETE FROM todo WHERE todo_id = $1", [
        id
      ]);
      res.json("Todo was deleted!");
    } catch (err) {
      console.log(err.message);
    }
  });

  app.post("/api/v1/weight-logging", async (req, res) => {
    try {
      const result = await db.query (`INSERT INTO weight_logging
        SELECT
          sv.device_id,
          sv.slave_id,
          sv.reg_add,
          sv.value,
          sv.u_time,
          sv.d_time
        FROM sensor_value sv
        WHERE sv.slave_id = '7'
        ORDER BY sv.u_time DESC
        LIMIT 1;
      `);
      res.status(200).json({ message: "Successfully Inserted",});
      
    } catch (err) {
      console.error(err.message);
      res.status(400).json({ error: err.message });
    }
  });
  
  
  app.get("/api/v1/weight-logging", async(req,res) => {
    try{
      const response = await db.query(`Select device_id,value,d_time from weight_logging`)
      res.status(200).json(response.rows);
    }catch(err){
      console.log(err.message)
      res.status(err.message)
    }
  })

app.post("/api/v1/add-slave/:device_id",async(req,res) => {
  try{
    const {device_id} = req.params;
    const {slave_id,reg_add,keys,minvalue,maxvalue,siunit} = req.body;
    const query = `Insert into sensor_parameters(slave_id,device_id,reg_add,keys,minvalue,maxvalue,siunit) Values ($1,$2,$3,$4,$5,$6,$7)  `;
    const values = [slave_id,device_id,reg_add,keys,minvalue,maxvalue,siunit]
    const result = await db.query(query,values)
    console.log(result.message) 
      res.status(200).json({message:"Successfully added"})

  }
  catch(err){
    res.status(500).json({message:"Failed"});
    console.log(err)
  }
})

app.delete("/api/v1/delete-slave/:device_id/:slave_id/:reg_add", async (req, res) => {
  try {
    const { device_id, slave_id, reg_add } = req.params;

    const query = `DELETE FROM sensor_parameters WHERE device_id = $1 AND slave_id = $2 AND reg_add = $3`;
    const values = [device_id, slave_id, reg_add];

    const result = await db.query(query, values);
    console.log(result);
    res.status(200).json({message: "Successfully deleted"})
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete" });
  }
});

app.post("/api/v1/device-management", async (req, res) => {
  try {
    const { uid, device_id } = req.body; 
    const query = `INSERT INTO device_management (uid, device_id,access) VALUES ($1, $2,$3)`;
    const values = [uid, device_id,1];
    await db.query(query, values);
    res.status(201).json({ message: "Data inserted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to insert data" });
  }
});


app.listen(port,() => {
    console.log(`Listening on port ${port}`)
})

