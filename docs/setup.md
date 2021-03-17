# Setting up a Code City Instance

This document describes how to recreate a Code City server from bare
metal.  For reference, the starting point is a Google Cloud Platform
account in good standing.


## Google Compute Engine Setup

We recommend running your Code City server on a [Google Compute
Engine](https://cloud.google.com/compute)</sup> (GCE) virtual
machine<sup>[[?]](
https://en.wikipedia.org/wiki/Virtual_machine)</sup> (VM)—it’s
reliable, minimal hassle, and, thanks to [Google Cloud Platform’s
“Always Free” tier](https://cloud.google.com/free), can be (very
nearly) free!

### Create a GCE instance

This will create a dedicated GCE instance (VM) on which to run Code
City.  You can skip this step if you intend to run your instance on
your own machine or another cloud provider’s hardware.

Before you begin: the GCE instance (VM) you create will run using the
permissions of a service account<sup>[[?]](
https://cloud.google.com/iam/docs/service-accounts)</sup>.  There is a
“Compute Engine default service account” which will work fine but has
quite broad permissions.  You may wish to create a service account
with more limited permissions, to reduce the amount of damage an
attacker can do if they compromise your Code City instance and gain
control of the VM on which it runs.  This is especially so if your GCP
project contains other resources (user data, etc.) which you wish to
protect.  See [Appendix A: Creating a Service Account](
#appendix-a-creating-a-service-account) for instructions.

1.  Go to the [Google Compute Engine
    console](https://console.cloud.google.com/compute/instances).
0.  Under VM Instances, click the create instance button ![blue icon
    with white plus](instance-new.svg).  Enter details as follows:
    *   Name: choose a name for the instance.  (This can be any name,
        but we recommend you use a name matching your intended domain
        name—e.g., `google.codecity.world` runs on an instance named
        `google`.)
    *   Region: choose a region near where you expect your users to
        be.  Note that [instance pricing varies by
        zone](https://cloud.google.com/compute/vm-instance-pricing).
    *   Zone: choose any.
    *   Machine type: choose an appropriate size.
        *   [GCP’s “Always Free” tier][always-free] offers one free
            `f1-micro` instance in any of `us-west1`, `us-central1` or
            `us-east1`.  This size will be sufficient for many smaller
            organisations/groups.
        *   Because of the architecture of the Code City server, there
            is unlikely to be any benefit to having more than two
            vCPUs (and one is generally sufficient).
    *   Container: no.
    *   Boot disk: under “Public images”, choose:
        *   Operating system: Debian
        *   Version: choose the most recent version—“Debian GNU/Linux
            10 (buster)” as of this writing.
        *   Boot disk type: Standard persistent disk.
        *   Size: the default 10GB is likely to be sufficient for most
            cases, but the “Always Free” program offers up to 30GB
            (total, not per-instance) of persistent disk free of
            charge.
    *   Identity and API access:
        *   Service account: use the default “Compute Engine default
            service account” or select the one you created by
            following the instructions in [appendix A](
            #appendix-a-creating-a-service-account).
        *   Access scopes: Allow default access.
    *   Firewall: Allow both HTTP and HTTPS traffic.
    *   Management:
        *   Recommended: tick “Enable deletion protection” to make it
            harder to inadvertently delete your Code City instance.
    *   Security:
        *   Recommended: tick “Turn on Secure Boot”.
        *   SSH Keys: you can add your ssh public key(s) here if you
            wish; doing so will cause them to be automatically added
            to the corresponding `~userid/.ssh/authorized_keys` file,
            but note:
            *   Keys added here apply only to this GCE instance.  If
                you expect your project to have multiple instances you
                may prefer to add your SSH keys on [the Compute Engine
                metadata page](
                https://pantheon.corp.google.com/compute/metadata/sshKeys)
                instead: keys added there will have access to all the
                project's GCE instances by default (i.e., unless you
                tick "Block project-wide SSH keys" on a particular
                instance).
            *   Even if you don’t add any SSH keys now you will in any
                case be able to SSH to the machine from [GCE instances
                page](
                https://console.cloud.google.com/compute/instances).
    *   Disks:
        *   Recommended: **un**tick “Delete boot disk when instance
            deleted” so that if you _do_ delete your instance you can
            recreate it easily and without losing user data.
    *   Networking:
        *   Under Network interfaces, click the pencil icon next to
            the default interface.
        *   External IP: ignore this section for now.
        *   Public DNS PTR Record: optionally click “Enable” and enter
            the [domain name](#set-up-an-ip-address-and-domain-name)
            you intend to use for your instance,
            e.g. <code><em>example</em>.codecity.world</code>.
        *   Click “Done” to end editing the network interface.
0.  Double-check the monthly cost estimate (at the top of the page) to
    ensure it is reasonable.
0.  Click “create” and you will be taken back to the VM instances
    dashboard.  After a few minutes, you should see your new instance
    is ready, and has internal and external IP addresses.
0.  Under “Connect”, click on “SSH” for your instance.
0.  Verify instance is running Debian 10:
    ```
    $ uname -a
    Linux instancename 4.19.0-9-cloud-amd64 #1 SMP Debian 4.19.118-2+deb10u1 (2020-06-07) x86_64 GNU/Linux
    ```

[always-free]: https://cloud.google.com/free/docs/gcp-free-tier#always-free-usage-limits
[service-account]: https://cloud.google.com/iam/docs/creating-managing-service-accounts

#### Reserve a Static IP Address

For users to be able to access your instance from the Internet, it
will need a static IP address<sup>[[?]](
https://en.wikipedia.org/wiki/IP_address) (like 192.0.2.1) so that
traffic can be routed to it.

1.  Go to the [Networking / External IP addresses
    console](https://console.cloud.google.com/networking/addresses).
0.  Click “+ Reserve Static Address”.  Enter details as follows:
    *   Name: can be any value, but we recommend you use the same name
        as for your instance.  This is just used to identify the
        address reservation.
    *   Description: enter any text you like—e.g.: “Static IP
        address for <em>example</em>.codecity.world.”
    *   Network Service Tier: choose either.  See [description of
        options](https://cloud.google.com/network-tiers/) and [pricing
        information](https://cloud.google.com/network-tiers/pricing).
    *   IP vesion: IPv4.
    *   Type: Regional.
        *   Region: choose the same region as your instance was
            created in.
        *   Attached to: choose your instance from the drop-down.
0.  Click “Reserve”.
0.  Make a note of the external address (like 192.0.2.1) which you
    have just reserved for your instance.

### Give Your Instance a Domain Name

The Domain Name System<sup>[[?]](
https://en.wikipedia.org/wiki/Domain_Name_System)</sup> is a
distributed global database that maps domain names (like
`example.org`) to IP addresses (like 192.0.2.1).

In order for users to be able to access your instance without having
to know the numeric static IP address you reserved in the previous
section, you must create a human-readable domain mame<sup>[[?]](
https://en.wikipedia.org/wiki/Domain_name)</sup> for it.

The details of this process are outside of the scope of this document,
but we have the following observations and recommendations:

*   Setting up DNS involves two distinct entities: a domain name
    registrar<sup>[[?]](
    https://en.wikipedia.org/wiki/Domain_name_registrar)</sup>, from
    whom you can purchase a domain name (like `example.org`), and a
    DNS provider, who runs the name servers<sup>[[?]](
    https://en.wikipedia.org/wiki/Name_server)</sup> that resolve
    individual DNS entries (like `www.example.com`) to specific
    numeric IP addresses like the one created in the previous section.
    
    In many cases both these services will be provided by the same
    company, but many organisations will typically run their own DNS
    servers, or outsource it to a [managed DNS provider](
    https://en.wikipedia.org/wiki/List_of_managed_DNS_providers).

*   If you are using your own domain name (e.g.,
    <code>codecity.<em>example.org</em></code>) this will be done
    through your DNS provider’s configuration console or via your
    internal organisational DNS service configuration.

*   Alternatively we may in some cases be able to offer you the
    use of a Code City subdomain (e.g.,
    <code><em>example</em>.codecity.world</code>), in which case
    we will take care of this step for you.  Contact us for
    details.

*   Because of the [same origin policy], if you’d like to allow
    individual (not fully trusted) users of your instance to be able
    to create their own web pages / servers, we *strongly* recommend
    that you use a wildcard DNS record<sup>[[?]](
    https://en.wikipedia.org/wiki/Wildcard_DNS_record)</sup>, so that
    each user can serve their content on an isolated subdomain (like
    <code><em>username</em>.example.codecity.world</code>).
    *  You will need to create (or arrange to have created) two
       separate DNS "A" records for your domain name:
       *   The main entry, e.g. `example.codecity.world`, type `A`,
           resolving to your instance's IP address, and
       *   The wildcard entry, e.g. `*.example.codecity.world`, also
           type `A`, resolving to the same IP address.
    *  To facilitate obtaining the necessary wildcard
       certificate<sup>[[?]](
       https://en.wikipedia.org/wiki/Wildcard_certificate)</sup>, we
       recommend you use a [DNS provider who easily integrates with
       Let’s Encrypt DNS validation][dns-providers], such as [Google
       Cloud DNS](https://cloud.google.com/dns/), if possible.
 
[same origin policy]: https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy
[dns-providers]: https://community.letsencrypt.org/t/dns-providers-who-easily-integrate-with-lets-encrypt-dns-validation/86438
 
### Recommended: schedule regular, automatic backups of your instance’s disk

It’s always best to back up!  Even though the Code City server
regularly checkpoints its database to the instance’s persistent disk,
setting up regular snapshotting of that disk will give you a separate
backup of the whole system in case of disaster.

Snapshots are [not free], but [are cheap].  A few dollars a month buys a
lot of peace of mind!

[not free]: https://cloud.google.com/compute/disks-image-pricing#persistentdisk
[are cheap]: https://cloud.google.com/compute/disks-image-pricing#persistent_disk_snapshots_storage_charges

First, create a snapshot schedule:

1.  Go to the [GCE Snapshots page](
    https://console.cloud.google.com/compute/snapshots) and click on
    the “Snapshot Schedules” tab.
0.  Click on Create Snapshot Schedule.  Enter details as follows:
    *   Name: choose a name for the schedule, e.g. `daily-14`.
    *   Description: anything, e.g. “Daily snapshots, kept for 14
        days”.
    *   Snapshot location: Regional.
    *   Region: choose the same region as your instance.
    *   Schedule frequency: hourly, daily or weekly as you prefer; for
        this example: daily.  (N.B.: more frequent snapshots will
        result in more data to be stored and thus higher costs.)
    *   Start time: any.  Snapshotting will not affect the running
        instance, so choose whatever time of day you wish.
    *   Auto-delete snapshots after: choose a suitable period of time;
        for this example: 14 days.
    *   Deletion rule: as you wish: “keep snapshots” better protects
        against data loss in the event that your instance is
        *inadvertently* deleted; “delete snapshots after _N_ days”
        better protects against continuing to be charged fees after
        you *deliberately* delete your instance.
    *   Enable VSS: no.  (Not applicable to non-Windows instances.)
    *   Snapshot labels: not needed.
0.  Click “Create” to create the schedule.

Now apply the schedule to your instance’s persistent disk:

4.  Go to the [GCE Disks page](
    https://console.cloud.google.com/compute/disks).
0.  Click on the name of the persistent disk for your instance.  (By
    default it will have the same name you gave to your instance.)
0.  Click on “Edit” at the top of the screen.
0.  Under Snapshot schedule, select the schedule you created in steps
    1–3.
0.  Click Save.

## Set Up Machine and Install Code City

These instructions assume you are using a GCE instance running Debian
GNU/Linux 10 "buster", but feel free to adapt to your particular
set-up.

1.  Log into your instance.  (See instructions in first section if
    using GCE.)
0.  If your machine has less than 2GB of memory (check with `free -h`;
    the very first number shown is total RAM), you will need to create
    a swap file (this is mandatory on `f1-micro` instances):
    ```
    sudo -i
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    swapon -s
    sh -c 'echo "/swapfile none swap sw 0 0" >> /etc/fstab'
    exit
    ```
0.  Check for and install system updates, then install
    [nginx](https://en.wikipedia.org/wiki/Nginx) and
    [git](https://git-scm.com/):
    ```
    sudo apt-get update
    sudo apt-get upgrade –y
    sudo apt-get install -y nginx git
    ```
0.  Optionally install a text editor of your choice.  Debian comes
    with [`vim`](https://www.vim.org/) and
    [`nano`](https://www.nano-editor.org/) preinstalled; Emacs users
    might feel more at home with the lightweight editors
    [`mg`](https://github.com/hboetes/mg),
    [`jove`](https://github.com/jonmacs/jove) or
    [`zile`](https://www.gnu.org/software/zile/), or opt for
    `emacs-nox` which is GNU Emacs without X Windows bindings.
    ```
    sudo apt-get install mg
    ```
0.  Install [node.js](https://nodejs.org/).  Code City depends on
    version 12, which is more recent than the version included in
    Debian 10, so we will obtain it via [NodeSource](
    https://github.com/nodesource/distributions):
    ```
    sudo -i
    curl -sL https://deb.nodesource.com/setup_12.x | bash -
    apt-get install -y nodejs
    exit
    ```
0.  Verify the correct version of node is installed:
    ```
    $ node –-version
    v12.18.4
    ```
    (Actual version may be later than 12.18.)

### Get TLS Certificates

In order to allow incoming HTTPS connections, you will need an
TLS<sup>[[?]](https://en.wikipedia.org/wiki/Transport_Layer_Security)</sup>
server certificate<sup>[[?]](
https://en.wikipedia.org/wiki/Public_key_certificate#TLS/SSL_server_certificate
)</sup>.  There are two types:

*   An ordinary certificate covers one or more specific domain names,
    like `www.example.org`.
*   A wildcard certificate includes one or more wildcard domains, like
    `*.example.org`.

You will need to get a TLS certificate covering the [set of DNS entries
you [created earlier](#set-up-an-ip-address-and-domain-name).  If (as
recommended) you created a wildcard DNS entry, you will also need a
corresponding wildcard TLS certificate.

There are various ways to get a TLS certificate, but a free and easy
way is to use [Certbot](https://certbot.eff.org/) to get one from
[Let’s Encrypt](https://letsencrypt.org/).  That’s what we’ll do here.

#### Getting a wildcard certificate

To use Certbot to get a wildcard certificate, you will need to use the
[`dns-01` challenge](
https://letsencrypt.org/docs/challenge-types/#dns-01-challenge), which
requires being able to create DNS TXT records<sup>[[?]](
https://en.wikipedia.org/wiki/TXT_record)</sup> for your domain name.
Here’s an example of how to do this if using Google Cloud DNS; see
[full instructions on the certbot website](
https://certbot.eff.org/lets-encrypt/debianbuster-nginx) if you use
another provider.

1.  Install certbot and the required plug-ins:
    ```
    sudo apt-get install -y certbot python3-certbot-dns-google
    ```
0.  Obtain credentials from your DNS provider, to allow Certbot to
    create TXT records, proving to Let’s Encrypt that you control your
    domain.  It [should be possible to skip this step](
    https://certbot-dns-google.readthedocs.io/en/stable/#credentials)
    when using Google Cloud DNS and running Certbot on GCE instance,
    but alas [due to a bug](
    https://github.com/certbot/certbot/issues/7933) this doesn’t yet
    work in Debian 10.
    1.  Go to the [Service Accounts](
        https://console.cloud.google.com/iam-admin/serviceaccounts)
        tab of the IAM & Admin section of the GCP console.
    0.  Find the service account under which your GCE instance runs;
        unless you elected otherwise above, this will be the one named
        “Compute Engine default service account”.  Click on the email
        address for the key to open the details pane.
    0.  Click on the keys tab.
    0.  From the Add Key pop-up menu, select “Create new key”.
        *   Choose Key Type: JSON.
        *   Click “Create”.
    0.  Your browser will download a file with a name of the form
        <code>scp <em>projectID–XXXXXXXXXXXX</em>.json</code>.  Now,
        transfer this file to your GCE instance using
        [`scp`](https://en.wikipedia.org/wiki/Secure_copy) **on your
        local machine**, e.g. <code>scp
        <em>projectID–XXXXXXXXXXXX</em>.json
        <em>example</em>.codecity.world:service-account.json</code>,
        or by pasting it into a terminal window, as follows:
        *   Open the `.json` file you downloaded in step 2.iv. in a
            text editor, select the whole contents and copy it to the
            clipboard.
        *   **On your instance**, enter the command `cat - >
            service-account.json `
        *   Paste the contents of the `.json` into the SSH window.
        *   Type `^D` to indicate end of file.
    0.  This credentials file will be needed when initially obtaining
        the TLS certificate as well as every few months when [Certbot
        will automatically renew it](
        https://certbot.eff.org/docs/using.html#automated-renewals),
        so move it to a safe place and protect it from tampering:
        ```
        sudo mv service-account.json /etc/service-account.json
        sudo chown root:root /etc/service-account.json
        sudo chmod 600 /etc/service-account.json
        ```
0.  Request a certificate for both the base domain name for your
    instance and the corresponding wildcard entry:
    ```
    sudo certbot certonly --dns-google \
         --dns-google-credentials /etc/service-account.json \
         --post-hook 'systemctl reload nginx' \
         -d 'example.codecity.world,*.example.codecity.world'
    ```
    If you have more than one DNS entry pointing at your instance,
    just add further comma-separated entries to the list after the
    `-d` directive.  (N.B.: No spaces between entries in this list!)
    *   Enter your email address when prompted.
    *   Agree the terms of service.
    *   Optionally agree to share your email address with the EFF.

#### Getting a non-wildcard certificate

This process is a little simpler and does not require the ability to
modify DNS TXT records.

1.  Install certbot (only):
    ```
    sudo apt-get install -y certbot
    ```

0.  Request a certificate for the base domain name for your instance
    (only):
    ```
    sudo certbot certonly --webroot --webroot-path /var/www/html \
         --post-hook 'systemctl reload nginx' \
         -d example.codecity.world
    ```
    *   Enter your email address at the prompt
    *   Agree the terms of service.
    *   Optionally agree to share your email address with the EFF.

### Install Code City

1.  Create an account for Code City to run under.  This is to isolate
    it from any other users/services on the machine, and contain the
    damage in the event that the server sandbox be compromised.  We’ll
    call the account `codecity` here, but any username is fine:
    ```
    sudo useradd -rms /bin/bash codecity
    ```
0.  Become the code city account:
    ```
    sudo -iu codecity
    ```
0.  Clone the [Code City
    repo](https://github.com/google/CodeCity).  (If you are a
    project collaborator, see below for [instructions on how to use
    SSH instad of HTTPS](#git-code-city-by-ssh-instead-of-https).)
    ```
    git clone https://github.com/google/CodeCity.git
    ```
0.  Install required NPMs:
    ```
    (cd CodeCity/server && npm ci --only=prod)
    (cd CodeCity/login && npm ci --only=prod)
    ```
0.  Exit from the `codecity` account.  We’re done with it for now, and
    we need to be able to sudo, which that account (deliberately) does
    not have permission to do.
    ```
    exit
    ```

### Configure NGINX

On Debian, per-host `nginx` configuration files are stored in
`/etc/nginx/sites-available` and enabled by symlinking them into
`/etc/nginx-sites-enabled`.  There is a `default` config supplied by
the `nginx` package, which should be disabled (unless you have already
modified it to serve other virutal hosts).

1.  Install the NGINX configuration file.  If you have a wildcard DNS
    record and corresponding wildcard TLS certificate, use the
    “subdomain” configuration:
    ```
    sudo cp ~codecity/CodeCity/etc/cc-subdomain.conf \
            /etc/nginx/sites-available/codecity
    ```
    Otherwise, use the “onedomain” configuration:
    ```
    sudo cp ~codecity/CodeCity/etc/cc-onedomain.conf \
            /etc/nginx/sites-available/codecity
    ```
0.  Edit /etc/nginx/sites-enabled to replace INSTANCENAME with the
    name(s) of your instance.  (See comments for details.  You may use
    another editor instead of nano if you wish!)
    ```
    sudo nano /etc/nginx/sites-available/codecity
    ```
0.  Enable the new configuration and reload (or restart) NGINX:
    ```
    sudo rm /etc/nginx/sites-enabled/default
    sudo ln -s /etc/nginx/sites-available/codecity \
               /etc/nginx/sites-enabled/codecity
    sudo systemctl reload-or-restart nginx
    ```

### Create an API Key for OAuth

The usual set-up for public Code City instances is to use [OAuth
2.0](https://oauth.net/2/) via Google’s OAuth service for logins.
This step will set up the necessary credentials to allow users to log
in to your instance using their Google (Gmail) account.  You can skip
this step if you intend to use a different login mechanism.

This must be done after installing nginx and CodeCity and obtaining a
TLS certificate because it depends on `logo-auth.png` being served by
nginx.

1.  Optionally replace `~codecity/CodeCity/static/logo-auth.png` with
    a logo representing your instance or organisation.  It should be a
    120x120px PNG image.
0.  Make sure you can access your desired logo using your web browser.
    If you are using a wildcard DNS configuration, it should be
    accessible via a URL like
    <code>static.<em>example</em>.codecity.world/logo-auth.png</code>;
    for a single-domain configuration it will instead be
    <code><em>example</em>.codecity.world/static/logo-auth.png</code>.
    Make a note of this URL.
0.  Go to [APIs & Services > OAuth consent screen](
    https://console.cloud.google.com/apis/credentials/consent).  Enter
    details as follows:
    *   Email address: select a suitable contact email address or
        Google Group for users of your service.
    *   Product name: this should include the name of your
        organisation; it may optionally contain the name “Code City”;
        it should not include “Google” or the like. N.B.: the same
        details are used for all services offered via a given Google
        Cloud Platform account.
    *   Homepage URL: this could be your organisation’s homepage or
        the URL of the front page for your instance (perhaps
        <code><em>example</em>.codecity.world</code> or
        <code>codecity.<em>yourdomain.tld</em></code>)
    *   Product logo URL: Should point at the URL for your your logo,
        as determined in step 2 above.
    *   Privacy policy URL: Provide a link to your privacy policy.
    *   Terms of service URL: may be left blank.
0.  Go to the [APIs & Services > Credentials
    console](https://console.cloud.google.com/apis/credentials).
0.  Click “Create credentials”; choose OAuth client ID.  Enter details
    as follows:
    *   Application type: Web application
    *   Name: a suitable full name for your instance, (e.g. “Code City
        for Springfield Highschool”).
    *   Authorized JavaScript origins: may be left blank.
    *   Authorized redirect URIs: for wildcard DNS configurations this
        will be of the form `https://login.example.codecity.world/`;
        for single-domain configurations it will instead be
        `https://example.codecity.world/login/`.
0.  Click Save.
0.  Now click on the newly-created client ID.  Make a note of the
    Client ID (it will be a long string like
    “00000000000-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com”)
    and the Client Secret (a shorter but similarly opaque jumble of
    characters).  You will need these later.

See also the [complete GCP OAuth 2.0 documentation](
https://support.google.com/cloud/answer/6158849) for more information.

### Configure Code City

1.  Become the code city account:
    ```
    sudo -iu codecity
    ```
0.  Create a config file for loginServer:
    *   Run loginServer once to create an empty config file:
        ```
        (cd ~/CodeCity/login && ./loginServer)
        ```
        Open `~/CodeCity/login/loginServer.cfg` in the text editor of
        your choice.
    *   Set `connectUrl` to the URL for the connect server.  If using
        a wildcard DNS entry for your instance, it will be the
        `connect.` subdomain of your instance’s name; otherwise it
        will be the `/connect` path on your instance.  For example:
        *   With wildcard DNS: `https://connect.example.codecity.world/`
        *   Without wildcard DNS:`https://example.codecity.world/connect/`
    *   Set `staticUrl` to the URL nginx will serve static content on.
        This works similarly to the previous entry, e.g.:
        *   With wildcard DNS: `https://static.example.codecity.world/`
        *   Without wildcard DNS:`https://example.codecity.world/static/`
    *   Set `clientID` and `clientSecret` to the values obtained
        earlier from [Google’s API Console](
        https://console.developers.google.com/apis).
    *   Set `cookieDomain` to your instance’s base domain name, e.g.:
        `example.codecity.world`.
    *   Set `password` to a secret, random string.  If you don’t have
        a convenient way to generate one locally, you can copy a
        [random string from random.org].
    *   Optionally, set `emailRegexp` to a [JavaScript regexp]
        matching email addresses which should be permitted to log in
        to your instance—e.g., `^.*@myorganisation\\.org$`.
0.  Create and edit a config file for connectServer:
    *   Run connectServer once to create an empty config file:
        ```
        (cd ~/CodeCity/connect && ./connectServer)
        ```
        Open `~/CodeCity/connect/connectServer.cfg` in the text editor
        of your choice.
    *   Set `loginUrl` to the URL for the login server, e.g.:
        *   With wildcard DNS: `https://login.example.codecity.world/`
        *   Without wildcard DNS:`https://example.codecity.world/login/`
    *   Set `staticUrl` and `password` to the _same_
        values used in `loginServer.cfg`.
0.  Modify the configuration for the in-core HTTP server:
    *   Open the file `~/CodeCity/core/core_99_startup.js` in the text
        editor of your choice.  Find the optional configuration
        section near the top of the file.
    *   Set `$.hosts.root.hostname` to your instance’s domain
        name—e.g., <code>$.hosts.root.hostname =
        '<em>example</em>.codecity.world';</code>
    *   Set `$.hosts.root.pathToSubdomain = false;` if you are using a
        wildcard DNS entry for your instance; otherwise set it to
        `true`.
    *   If you have more than one DNS entry for your instance, set
        `$.hosts.root.hostRegExp` according to the instructions
        provided.
0.  Save the file, exit your editor and exit from the `codecity`
    account.
    ```
    exit
    ```

[JavaScript regexp]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
[random string from random.org]: https://www.random.org/strings/?num=1&len=20&digits=on&upperalpha=on&loweralpha=on&unique=on&format=html&rnd=new

### Configure Systemd and Start Code City Servers

1.  Install the systemd config files:
    ```
    sudo cp ~codecity/CodeCity/etc/*.service /etc/systemd/system
    ```
0.  Check the contents of `/etc/systemd/system/codecity.service`,
    …`codecity-login.service` and …`codecity-connect.service`; verify
    paths, usernames etc. all match the values created in previous
    steps.
0.  Enable Code City services with systemd:
    ```
    sudo systemctl enable --now codecity
    ```
0.  Verify you can connect to your new Code City instance by pointing
    your web browser its domain name—e.g., `https://example.codecity.world`.

Congratulations, you're done!

## Appendix A: Creating a Service Account

To protect any other Google Cloud Platform services you run against
the consequences of your Code City instance being compromised, you can
have the GCE VM it runs on use only the limited permissions of a
custom service account, rather than the extensive permissions held by
the Compute Engine default service account.  To do this there are three
steps:

1.  Creating one or more roles for the service account.
0.  Creating a service account
0.  Applying the service account to the GCE instance.

### Create Role(s)

You should create one role for running CodeCity instances on GCE, and
optionally create a second role if you intend to have your GCE
instance [obtain wildcard TLS certificates using certbot via the ACME
HTTP-01 challenge](#getting-a-wildcard-certificate).

1.  Go to the [Roles tab of IAM & Admin](
    https://console.cloud.google.com/iam-admin/roles).
0.  Create a role for running a Code City instance by clicking “+
    Create Role” then enter details as follows:
    *   Title: “CodeCity Instance”.
    *   Description: “Base role for all CodeCity instances.  Created
        on: …”.
    *   ID: `instance`.
    *   Add the following permissions by clicking “+ Add Permissions”
        button, typing the name of the permission into the “Filter
        table” field (*not* the “Filter permissions by role” field),
        selecting required permission, and clicking Add:
        *   `compute.globalOperations.get`
        *   `compute.zoneOperations.get`
        *   `logging.logEntries.create`
    *   Click “Create”.
0.  Optionally create a second role for obtaining wildcard certs by
    again clicking “+ Create Role” and entering:
    *   Title: “CodeCity Cert-via-DNS”
    *   Description: “Add-on permission to allow an instance to update
        its own wildcard letsencrypt SSL cert via an ACME dns-01
        challenge.  Created on: …”.
    *   ID: `dnscert`.
    *   Add the following permisions:
        *   `dns.changes.create`
        *   `dns.changes.get`
        *   `dns.managedZones.list`
        *   `dns.resourceRecordSets.create`
        *   `dns.resourceRecordSets.delete`
        *   `dns.resourceRecordSets.list`
        *   `dns.resourceRecordSets.update`
    *   Click “Create”.

### Create a Service Account

Now you can create a service account for your instance.

1.  Go to the [Service Accounts tab of IAM & Admin](
    https://console.cloud.google.com/iam-admin/serviceaccounts).
0.  Click “+ Create Servce Account” and enter details as follows:
    *   Service account name: choose and appropriate name such as
        “CodeCity instance” or “instance-<em>myInstanceName</em>”.
    *   Service account ID: modify suggested ID if desired.
    *   Service account description: “Service account for the
        <em>example</em>.codecity.world instance” or similar.
0.  Click “Create”.
    *   Where it says “Select a role”, select “CodeCity Instance”.
    *   If you intend to use certbot to obtain a wildcare DNS cert,
        click “+ Add Another Role” and select “CodeCity Cert-via-DNS”.
0.  Click “Continue”.
0.  Click “Done.

### Use the Service Account to run your GCE Instance

If you have not yet done so, simply [follow the instructions to create
a GCE instance for Code City](#create-a-gce-instance) and, when you
get to the “Identity and API access” section of the creation wizard,
select the service account you created previously.

Otherwise, if you have already created your GCE instance, configure it
to use the newly-create service account as follows:

1.  Go to the [VM instances tab](
    https://console.cloud.google.com/compute/instances).
0.  Select the VM instance you created previously.
0.  Click the stop button at the top of the page to stop it, if it is
    running.
0.  Click the name of your instance to view its “VM instnace details”
    page.
0.  Click “Edit”.
0.  Scroll down to “Service account” and select the service account
    you created previously.

## Appendix B: Remote Debugging

If you need to debug the server because it has stopped responding to
network activity, here’s how to do that:


1.  SSH in to the GCE instance and enable the inspector on the running server:
    *   <code>$ <strong>sudo kill -s SIGUSR1 `pidof codecity`</strong></code>
0.  Look in /var/log/daemon.log for a message like:
    ```
    Feb 26 01:22:49 google codecity[19464]: Debugger listening on ws://127.0.0.1:9229/8df977b7-024d-464d-84c2-44321dd5b398
    Feb 26 01:22:49 google codecity[19464]: For help, see: https://nodejs.org/en/docs/inspector
    ```
    Note the port number (in this case 9229).
0.  SSH in to the GCE instance again, enabling port forwarding:
    ```
    ssh -L 9229:localhost:9229 google.codecity.world
    ```
    *   The initial 9229 can be replaced with a local port number of
        your choice.
    *   The `:localhost:` directive ensures that only processes
        running on your local machine can make use of the port
        forward.
0.  Open the inspector in Chrome by going to
    [`chrome://inspect`](chrome://inspect).

(Based on [node.js debugging documentation](
https://nodejs.org/en/docs/guides/debugging-getting-started/) and [a
related blog post](
https://hackernoon.com/debugging-node-without-restarting-processes-bd5d5c98f200).)


## Appendix C: Additional Instructions for Code City Collaborators

### GIT Code City by SSH instead of HTTPS

During early development, the Code City repository was private so it
was necessary to do the `git clone` by SSH instead of HTTPS.  We
continue to do this on our production instance to allow commits to the
`prod` branch to be made from there if necessary.

To avoid putting SSH private keys on the instance, we use SSH agent
forwarding.  This would mostly be automatic except that we also need
to be able to use our personal credentials as the user `codecity`.
The solution is adapted [from Server Fault](
https://serverfault.com/questions/107187).

#### Preparation (do once)

1.  Add your SSH public key (ideally, one from a hardware token or the
    like) to [your GitHub account](https://github.com/settings/keys).
0.  Verify that you can ssh to GitHub from your local workstation:
    ```
    ssh -T git@github.com
    ```
    Output should look like “<code>Hi <em>username</em>! You've
    successfully authenticated, but GitHub does not provide shell
    access.</code>”
0.  Edit `~/.ssh/config` to add the following directive, if not
    already present:
    ```
    ForwardAgent yes
    ```
    This will enable agent forwarding by default.

#### When setting up a CodeCity GCE instance

These instructions replace step 3 of [Install & Configure Code
City](#install--configure-code-city).

4.  Ensure that your SSH public key can be used to log in to the
    instance.  This can be done in two ways:
    *   Preferred: add it to [the Compute Engine metadata page](
        https://pantheon.corp.google.com/compute/metadata/sshKeys).
    *   Alternatively: add it to the instance at creation or by
        editing the instance on [the GCE instances page](
        https://console.cloud.google.com/compute/instances).
    *   Alternatively: log into the instance initially using the
        browser-based SSH available via the GCE console.  Use the text
        editor of your choice to append your SSH public key to
        `~/.ssh/authorized_keys`.
0.  Ensure you can ssh to your instance from the command line of your
    local machine.  Use `-A` to enable agent forwarding (`ssh -A
    example.codecity.world`) or add `ForwardAgent yes` to your
    `~/.ssh/config` file.
0.  From your instance, verify that agent forwarding is working:
    ```
    ssh -T git@github.com
    ```
    (Expected output similar to step 2 above above.)
0.  Install the acl package:
    ```
    sudo apt-get install -y acl
    ```
0.  On your instance, after creating the `codecity` user, add the
    following to your `.bashrc` or `.bash_login`:
    ```
    setfacl -m codecity:x $(dirname "$SSH_AUTH_SOCK")
    setfacl -m codecity:rw "$SSH_AUTH_SOCK"
    ```
0.  Modify the machine’s sudo config to tell sudo not to wipe
    `SSH_AUTH_SOCK` from the environment:
    ```
    sudo visudo -f /etc/sudoers.d/ssh-agent-forwarding
    ```
    * Add the line
    ```
    Defaults env_keep+=SSH_AUTH_SOCK
    ```
    then save and exit.
0.  When becoming the codecity user, be sure to use “`sudo -iu
    codecity`” instead of “`sudo su - cc`”—the latter will clear the
    needed `SSH_AUTH_SOCK` environment variable.
0.  Install Code City using the SSH repository path:
    ```
    git clone git@github.com:google/CodeCity.git
    ```

#### Getting SSL Certificates

Google-internal GCE instances are by default firewalled to prevent
inbound access from the Internet; this causes Certbot’s ACME checks to
fail.  The preferred solution is to use the DNS-01 challenge, even if
no wildcard cert is required.
