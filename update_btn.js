const fs = require('fs');
let code = fs.readFileSync('frontend/public/js/vms.js', 'utf8');

code = code.replace(
  '<button class="btn btn-sm btn-danger" onclick="vmAction(\\'${vm.node}\\',${vm.vmid},\\'stop\\',\\'` + '${vm.type}\\',\\'${vm.name}\\')">âš¡ Stop</button>',
  '<button class="btn btn-sm btn-danger" onclick="vmAction(\\'${vm.node}\\',${vm.vmid},\\'stop\\',\\'` + '${vm.type}\\',\\'${vm.name}\\')">âš¡ Stop</button>\\n      ${vm.type === \\'qemu\\' ? `<button class="btn btn-sm btn-outline" style="border-color:#a855f7; color:#d8b4fe;" onclick="vmMigrateDialog(\\'${vm.node}\\',${vm.vmid},\\'${vm.name}\\')">ðŸš€ Migrate</button>` : \\'\\'}'
);

code = code.replace(
  '<button class="btn btn-sm btn-danger btn-icon" onclick="vmAction(\\'${vm.node}\\',${vm.vmid},\\'stop\\',\\'` + '${vm.type}\\',\\'${vm.name}\\')" title="Force Stop">âš¡</button>',
  '<button class="btn btn-sm btn-danger btn-icon" onclick="vmAction(\\'${vm.node}\\',${vm.vmid},\\'stop\\',\\'` + '${vm.type}\\',\\'${vm.name}\\')" title="Force Stop">âš¡</button>\\n            ${vm.type === \\'qemu\\' ? `<button class="btn btn-sm btn-outline btn-icon" style="border-color:#a855f7; color:#d8b4fe;" onclick="vmMigrateDialog(\\'${vm.node}\\',${vm.vmid},\\'${vm.name}\\')" title="Migrate">ðŸš€</button>` : \\'\\'}'
);

fs.writeFileSync('frontend/public/js/vms.js', code);
console.log('Update completato!');