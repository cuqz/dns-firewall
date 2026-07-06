"""Retry VM creation every 30s until capacity opens. Ctrl+C to stop."""
import oci, time

config = oci.config.from_file()
compute = oci.core.ComputeClient(config)

with open('C:\\Users\\WezaMwiwa\\Downloads\\ssh-key-2026-07-06.key.pub') as f:
    ssh_key = f.read().strip()

subnet_id = 'ocid1.subnet.oc1.af-johannesburg-1.aaaaaaaapn27b35e6yhgf4kdok7vguacn6hfebpt75ru4rvsanzpd5ktgg3a'

details = oci.core.models.LaunchInstanceDetails(
    display_name='dns-firewall',
    compartment_id=config['tenancy'],
    availability_domain='idHE:AF-JOHANNESBURG-1-AD-1',
    shape='VM.Standard.A1.Flex',
    shape_config=oci.core.models.LaunchInstanceShapeConfigDetails(ocpus=1, memory_in_gbs=6),
    source_details=oci.core.models.InstanceSourceViaImageDetails(
        image_id='ocid1.image.oc1.af-johannesburg-1.aaaaaaaa2ngirhwdkle6ttnioakq5m55rtjwgthtdpgoprszc3a6sv4nqw4q',
        boot_volume_size_in_gbs=200),
    create_vnic_details=oci.core.models.CreateVnicDetails(subnet_id=subnet_id, assign_public_ip=True),
    metadata={'ssh_authorized_keys': ssh_key}
)

print('Retrying every 30s. Ctrl+C to stop.')
while True:
    try:
        instance = compute.launch_instance(details).data
        print(f'SUCCESS! Instance: {instance.id}')
        print(f'Check Public IP in Oracle console, then run deploy.ps1')
        break
    except Exception as e:
        msg = str(e)
        if 'Out of host capacity' in msg:
            print(f'{time.strftime("%H:%M:%S")} - No capacity, retrying in 30s...')
        else:
            print(f'{time.strftime("%H:%M:%S")} - {msg[:100]}')
        time.sleep(30)
