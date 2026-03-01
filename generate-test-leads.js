// Run: node generate-test-leads.js
// Generates test-leads.xlsx in the project root

const XLSX = require('xlsx')

const schools = [
  { name: 'Delhi Public School, RK Puram',     city: 'New Delhi'   },
  { name: 'Kendriya Vidyalaya, Sector 8',       city: 'Dwarka'      },
  { name: 'Ryan International School',          city: 'Noida'       },
  { name: 'St. Columba\'s School',              city: 'New Delhi'   },
  { name: 'Amity International School',         city: 'Gurugram'    },
  { name: 'The Shri Ram School',                city: 'Vasant Vihar'},
  { name: 'Sardar Patel Vidyalaya',             city: 'New Delhi'   },
  { name: 'Bal Bharati Public School',          city: 'Pitampura'   },
  { name: 'Modern School, Barakhamba Road',     city: 'New Delhi'   },
  { name: 'Springdales School, Pusa Road',      city: 'New Delhi'   },
  { name: 'Army Public School, Dhaula Kuan',    city: 'New Delhi'   },
  { name: 'Presidium School, Dwarka',           city: 'Dwarka'      },
  { name: 'G.D. Goenka Public School',          city: 'Gurugram'    },
  { name: 'Lotus Valley International School',  city: 'Noida'       },
  { name: 'Birla Vidya Niketan',                city: 'New Delhi'   },
]

const firstNames = [
  'Aarav','Vivaan','Aditya','Vihaan','Arjun','Reyansh','Ayaan','Atharv','Dhruv','Kabir',
  'Ananya','Diya','Piya','Saanvi','Myra','Ridhi','Ishita','Aanya','Kiara','Riya',
  'Rohan','Mohit','Karan','Nikhil','Siddharth','Priya','Sneha','Pooja','Neha','Divya',
  'Aryan','Shaurya','Yash','Harsh','Rajat','Simran','Naina','Tanya','Meera','Kavya',
]

const lastNames = [
  'Sharma','Verma','Singh','Gupta','Kumar','Patel','Joshi','Mehta','Agarwal','Saxena',
  'Mishra','Tiwari','Yadav','Kapoor','Malhotra','Chopra','Bhatia','Nair','Reddy','Iyer',
]

const courses = [
  'B.Tech (CSE)', 'B.Tech (ECE)', 'BBA', 'BCA', 'B.Com (Hons)',
  'BA (Hons) Economics', 'B.Sc (Hons) Physics', 'B.Sc (Hons) Mathematics',
  'MBA', 'MCA',
]

const sources = ['Website','Instagram','Facebook','Walk-In','School Fair','Referral','JustDial','Newspaper']

const notes = [
  'Parents enquired on behalf of student',
  'Interested in scholarship',
  'Wants hostel facility',
  'Appearing in boards this year',
  'Shifting from another state',
  'Sibling already enrolled',
  '',
  '',
  '',
]

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function randPhone() {
  const prefixes = ['98','97','96','95','94','93','92','91','90','89','88','87','86','85','84','83','82','81','80','79','78','77','76','75','74','73','70']
  return rand(prefixes) + String(Math.floor(10000000 + Math.random() * 89999999))
}
function randEmail(name) {
  const domains = ['gmail.com','yahoo.com','outlook.com','hotmail.com']
  return name.toLowerCase().replace(/\s+/g,'') + Math.floor(100 + Math.random() * 899) + '@' + rand(domains)
}

const rows = []

schools.forEach((school) => {
  // 4–8 students per school
  const count = 4 + Math.floor(Math.random() * 5)
  for (let i = 0; i < count; i++) {
    const first = rand(firstNames)
    const last  = rand(lastNames)
    const name  = `${first} ${last}`
    rows.push({
      'Student Name':  name,
      'Phone':         randPhone(),
      'Email':         randEmail(name),
      'City':          school.city,
      'School Name':   school.name,
      'Course Interest': rand(courses),
      'Source':        rand(sources),
      'Notes':         rand(notes),
    })
  }
})

// Shuffle rows so schools aren't grouped (realistic import)
for (let i = rows.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [rows[i], rows[j]] = [rows[j], rows[i]]
}

const ws = XLSX.utils.json_to_sheet(rows)

// Column widths
ws['!cols'] = [
  { wch: 22 }, // Student Name
  { wch: 14 }, // Phone
  { wch: 30 }, // Email
  { wch: 16 }, // City
  { wch: 38 }, // School Name
  { wch: 22 }, // Course Interest
  { wch: 14 }, // Source
  { wch: 35 }, // Notes
]

const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'Test Leads')

XLSX.writeFile(wb, 'test-leads.xlsx')

console.log(`Generated test-leads.xlsx — ${rows.length} leads across ${schools.length} schools`)
